/**
 * Orbivex AI config — powered by the NVIDIA API (NIM / build.nvidia.com).
 *
 * NVIDIA exposes an OpenAI-compatible REST API, so every agent keeps calling
 * `generateCompletion(model, prompt, options)` exactly as before — this module
 * is the single chokepoint that talks to NVIDIA.
 *
 * Env:
 *   NVIDIA_API_KEY   — required (nvapi-...). Leave empty to disable AI.
 *   NVIDIA_MODEL     — default model id (e.g. meta/llama-3.3-70b-instruct)
 *   NVIDIA_BASE_URL  — default https://integrate.api.nvidia.com/v1
 */

const BASE_URL = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const DEFAULT_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';

/* Friendly tier → concrete NVIDIA model id. Lets the admin UI offer
   "Standard / Advanced" without leaking infra model names to customers. */
const TIER_MODELS = {
  standard: process.env.NVIDIA_MODEL_STANDARD || 'meta/llama-3.1-8b-instruct',
  advanced: process.env.NVIDIA_MODEL_ADVANCED || 'meta/llama-3.3-70b-instruct',
};

/** Resolve whatever the agent passed (tier label, legacy ollama name, or a
 *  real NVIDIA id) down to a concrete NVIDIA model id. */
function resolveModel(model) {
  if (!model) return DEFAULT_MODEL;
  const key = String(model).toLowerCase();
  if (TIER_MODELS[key]) return TIER_MODELS[key];
  // A real NVIDIA id always contains a "/". Legacy names (phi3, mistral,
  // qwen2.5:1.5b, claude) are ignored and fall back to the default model.
  if (key.includes('/')) return model;
  return DEFAULT_MODEL;
}

function apiKey() {
  return process.env.NVIDIA_API_KEY || '';
}

// ── LRU response cache ───────────────────────────────────────────────────────
const CACHE_MAX     = parseInt(process.env.AI_CACHE_MAX     || '256',        10);
const CACHE_TTL_MS  = parseInt(process.env.AI_CACHE_TTL_MS  || String(30 * 60_000), 10);
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) { cache.delete(key); return null; }
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Concurrency limiter (polite throttle) ────────────────────────────────────
const MAX_CONCURRENT = parseInt(process.env.AI_MAX_CONCURRENT || '8', 10);
let inflight = 0;
const waitQueue = [];

function acquire() {
  if (inflight < MAX_CONCURRENT) { inflight++; return Promise.resolve(); }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function release() {
  inflight--;
  const next = waitQueue.shift();
  if (next) { inflight++; next(); }
}

/**
 * generateCompletion — calls NVIDIA's OpenAI-compatible chat endpoint.
 *
 * @param {string} model    — tier label / model id (resolved via resolveModel)
 * @param {string} prompt
 * @param {object} options  — temperature, max_tokens, timeoutMs, cache
 * @returns {Promise<string>}
 */
async function generateCompletion(model, prompt, options = {}) {
  if (!apiKey()) {
    throw new Error('NVIDIA_API_KEY is not set. Add it to your environment variables.');
  }

  const resolvedModel = resolveModel(model);
  const useCache   = options.cache !== false;
  const maxTokens  = Math.min(options.max_tokens || 2048, 4096);
  const temperature = options.temperature !== undefined ? options.temperature : 0.3;
  const timeoutMs  = options.timeoutMs || 60_000;
  const cacheKey   = useCache ? `nvidia::${resolvedModel}::${maxTokens}::${temperature}::${prompt}` : null;

  if (cacheKey) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  await acquire();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        top_p: 1,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`NVIDIA API ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (cacheKey && text) cacheSet(cacheKey, text);
    return text;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`NVIDIA API request timed out after ${timeoutMs}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
    release();
  }
}

/**
 * checkHealth — used by GET /api/health
 */
async function checkHealth() {
  return {
    status:   apiKey() ? 'configured' : 'not_configured',
    provider: 'nvidia',
    model:    DEFAULT_MODEL,
    inflight,
    waiting:  waitQueue.length,
    max:      MAX_CONCURRENT,
    cache:    { size: cache.size, max: CACHE_MAX },
  };
}

module.exports = { generateCompletion, checkHealth, resolveModel, TIER_MODELS };
