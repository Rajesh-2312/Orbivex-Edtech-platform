/**
 * Orbivex Embed — NVIDIA NIM text embeddings
 *
 * Model: nvidia/nv-embedqa-e5-v5 (1024-dim, optimised for retrieval Q&A)
 * Requires NVIDIA_API_KEY — embeddings are NIM-only (OpenRouter does not
 * offer an embeddings endpoint).
 *
 * IMPORTANT — this is an *asymmetric* retrieval model. The stored document and
 * the incoming question are embedded by two different projections, selected by
 * `input_type`:
 *
 *   input_type: 'passage'  → text being indexed  (lesson chunks, questions)
 *   input_type: 'query'    → the student's question
 *
 * Embedding passages as 'query' lands them in the wrong half of the space and
 * silently degrades every similarity score, so callers must be explicit:
 * `embedBatch` defaults to 'passage' (it only ever indexes) and `embedText`
 * defaults to 'query' (its callers only ever search).
 *
 * Env:
 *   NVIDIA_API_KEY     — required
 *   NVIDIA_BASE_URL    — default https://integrate.api.nvidia.com/v1
 *   NVIDIA_EMBED_MODEL — override NIM model
 */

const BASE_URL = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const NIM_MODEL = process.env.NVIDIA_EMBED_MODEL || 'nvidia/nv-embedqa-e5-v5';
const NIM_DIM   = 1024;

// Export the active dimension so callers can size their vector columns correctly
const EMBED_DIM = NIM_DIM;

const INPUT_TYPES = new Set(['query', 'passage']);

// ── Query-embedding cache ────────────────────────────────────────────────────
// Every retrieval turn embeds the question before it can search — a NIM
// round-trip (~200ms) on the critical path. In a cohort of thousands of
// students on one syllabus the same questions recur constantly, so an LRU on
// normalised query text turns most of those into a map lookup. Passages are
// never cached (each is embedded once, at index time).
const QCACHE_MAX = parseInt(process.env.EMBED_QUERY_CACHE_MAX || '512', 10);
const queryCache = new Map();

function normalizeQuery(text) {
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

function queryCacheGet(key) {
  const hit = queryCache.get(key);
  if (!hit) return null;
  queryCache.delete(key);       // refresh recency
  queryCache.set(key, hit);
  return hit;
}

function queryCacheSet(key, vec) {
  if (queryCache.size >= QCACHE_MAX) queryCache.delete(queryCache.keys().next().value);
  queryCache.set(key, vec);
}

/**
 * One embeddings call. `inputs` is an array — the endpoint is OpenAI-compatible
 * and embeds the whole array in a single round-trip, which is far cheaper than
 * one request per string.
 *
 * @returns {Promise<number[][]>} vectors, ordered to match `inputs`
 */
async function embedRequest(inputs, inputType) {
  if (!process.env.NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY is not set — embeddings require the NVIDIA NIM API.');
  }
  if (!INPUT_TYPES.has(inputType)) {
    throw new Error(`embed: input_type must be 'query' or 'passage' (got ${inputType})`);
  }

  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      input: inputs,
      input_type: inputType,
      encoding_format: 'float',
      truncate: 'END',
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`NIM embed ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const rows = data?.data;
  if (!Array.isArray(rows) || rows.length !== inputs.length) {
    throw new Error(`NIM embed: expected ${inputs.length} vectors, got ${Array.isArray(rows) ? rows.length : typeof rows}`);
  }

  // The API may return rows out of order; `index` is authoritative when present,
  // otherwise fall back to arrival order.
  const out = new Array(inputs.length);
  rows.forEach((row, position) => {
    const vec = row?.embedding;
    if (!Array.isArray(vec) || vec.length !== NIM_DIM) {
      throw new Error(`NIM embed: unexpected vector shape (got ${Array.isArray(vec) ? vec.length : typeof vec}, want ${NIM_DIM})`);
    }
    const slot = typeof row.index === 'number' ? row.index : position;
    if (slot < 0 || slot >= inputs.length) {
      throw new Error(`NIM embed: row index ${slot} out of range for ${inputs.length} inputs`);
    }
    out[slot] = vec;
  });

  if (out.some((v) => v === undefined)) {
    throw new Error('NIM embed: response did not cover every input');
  }
  return out;
}

/**
 * Embed a single string. Defaults to 'query' — every current caller is a search
 * path. Pass { inputType: 'passage' } when embedding something being stored.
 */
async function embedText(text, { inputType = 'query', cache = true } = {}) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('embedText: empty input');

  const useCache = cache && inputType === 'query';
  const key = useCache ? normalizeQuery(clean) : null;
  if (key) {
    const hit = queryCacheGet(key);
    if (hit) return hit;
  }

  const [vec] = await embedRequest([clean], inputType);
  if (key) queryCacheSet(key, vec);
  return vec;
}

/**
 * Embed many strings. Defaults to 'passage' — batching only happens while
 * indexing. Empty/whitespace entries are rejected rather than silently skipped,
 * so the returned array always aligns positionally with `texts`.
 */
async function embedBatch(texts, { batchSize = 32, inputType = 'passage' } = {}) {
  const clean = texts.map((t, i) => {
    const s = String(t || '').trim();
    if (!s) throw new Error(`embedBatch: empty input at index ${i}`);
    return s;
  });

  const out = new Array(clean.length);
  for (let i = 0; i < clean.length; i += batchSize) {
    const vecs = await embedRequest(clean.slice(i, i + batchSize), inputType);
    for (let j = 0; j < vecs.length; j++) out[i + j] = vecs[j];
  }
  return out;
}

module.exports = { embedText, embedBatch, embedRequest, EMBED_DIM, NIM_DIM };
