/**
 * Orbivex Embed — NVIDIA NIM text embeddings
 *
 * Model: nvidia/nv-embedqa-e5-v5 (1024-dim, optimised for retrieval Q&A)
 * Falls back to nomic-embed-text via Ollama when NVIDIA_API_KEY is absent.
 *
 * Env:
 *   NVIDIA_API_KEY     — primary (NIM)
 *   NVIDIA_BASE_URL    — default https://integrate.api.nvidia.com/v1
 *   NVIDIA_EMBED_MODEL — override NIM model
 *   OLLAMA_URL         — fallback Ollama host
 *   OLLAMA_EMBED_MODEL — fallback model (nomic-embed-text, 768-dim)
 */

const BASE_URL = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const NIM_MODEL = process.env.NVIDIA_EMBED_MODEL || 'nvidia/nv-embedqa-e5-v5';
const NIM_DIM   = 1024;

const OLLAMA_URL   = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const OLLAMA_DIM   = 768;

// Export the active dimension so callers can size their vector columns correctly
const EMBED_DIM = process.env.NVIDIA_API_KEY ? NIM_DIM : OLLAMA_DIM;

async function embedViaNIM(text) {
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      input: text,
      input_type: 'query',
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
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== NIM_DIM) {
    throw new Error(`NIM embed: unexpected vector shape (got ${Array.isArray(vec) ? vec.length : typeof vec}, want ${NIM_DIM})`);
  }
  return vec;
}

async function embedViaOllama(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text, keep_alive: '10m' }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Ollama embed ${res.status}`);
  const data = await res.json();
  const vec = data?.embedding;
  if (!Array.isArray(vec)) throw new Error('Ollama embed: no embedding in response');
  return vec;
}

async function embedText(text) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('embedText: empty input');

  return process.env.NVIDIA_API_KEY
    ? embedViaNIM(clean)
    : embedViaOllama(clean);
}

async function embedBatch(texts, { batchSize = 16 } = {}) {
  const out = new Array(texts.length);
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize);
    const vecs = await Promise.all(slice.map(embedText));
    for (let j = 0; j < vecs.length; j++) out[i + j] = vecs[j];
  }
  return out;
}

module.exports = { embedText, embedBatch, EMBED_DIM, NIM_DIM, OLLAMA_DIM };
