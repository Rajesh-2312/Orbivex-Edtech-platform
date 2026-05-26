const axios = require('axios');
const http = require('http');
const https = require('https');

// ─── Ollama (local, fallback) ─────────────────────────────────────────
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '10m';

// ─── NVIDIA NIM (remote, primary when key is set) ─────────────────────
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';
const NVIDIA_BASE_URL = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');

// Ollama concurrency cap: local GPU/CPU serializes generations per model.
const MAX_CONCURRENT = parseInt(process.env.OLLAMA_MAX_CONCURRENT || '3', 10);
let inflight = 0;
const queue = [];

function acquire() {
  if (inflight < MAX_CONCURRENT) {
    inflight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}

function release() {
  inflight--;
  const next = queue.shift();
  if (next) {
    inflight++;
    next();
  }
}

// NVIDIA inflight cap (independent of Ollama queue). Free tier is ~40 RPM,
// so 8 concurrent gives headroom without spiking. Remote infra doesn't
// serialize like a local GPU, so this is a polite throttle, not a hard need.
const NVIDIA_MAX_CONCURRENT = parseInt(process.env.NVIDIA_MAX_CONCURRENT || '8', 10);
let nvidiaInflight = 0;
const nvidiaQueue = [];

function nvidiaAcquire() {
  if (nvidiaInflight < NVIDIA_MAX_CONCURRENT) {
    nvidiaInflight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => nvidiaQueue.push(resolve));
}

function nvidiaRelease() {
  nvidiaInflight--;
  const next = nvidiaQueue.shift();
  if (next) {
    nvidiaInflight++;
    next();
  }
}

// LRU cache, keyed per provider so cross-provider results never collide.
const CACHE_MAX = parseInt(process.env.OLLAMA_CACHE_MAX || '256', 10);
const CACHE_TTL_MS = parseInt(process.env.OLLAMA_CACHE_TTL_MS || String(30 * 60_000), 10);
const cache = new Map(); // key → { value, expiresAt }

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
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Persistent connections — useful at scale for both providers.
const ollamaHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 64 });
const nvidiaHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64 });

// ─── Status tracking for /api/health ──────────────────────────────────
let nvidiaLastError = null;          // { status, code, message, ts } | null
let nvidiaLoggedPrimaryOnce = false; // first successful call announces itself
const nvidiaLoggedFailureClasses = new Set(); // 'auth' | 'ratelimit' | 'server' | 'network' | 'shape' | 'json_format'

function classifyNvidiaError(err) {
  const status = err?.response?.status;
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'ratelimit';
  if (status && status >= 500) return 'server';
  if (status === 400 && /response_format/i.test(JSON.stringify(err?.response?.data || ''))) return 'json_format';
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) return 'network';
  if (err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNREFUSED') return 'network';
  if (err?.message === 'malformed_response') return 'shape';
  return 'unknown';
}

/**
 * Private: call NVIDIA NIM chat completions. Throws on any failure
 * so the public router can fall back to Ollama.
 */
async function nvidiaGenerate(prompt, options = {}) {
  if (!NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY not set');

  const body = {
    model: NVIDIA_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? 0.7,
    top_p: options.top_p ?? 0.9,
    max_tokens: options.max_tokens || 4096,
    stream: false,
  };
  // Intentionally NOT sending `response_format: json_object` here.
  // NVIDIA forces the top-level to be a single object when that flag is set,
  // which makes Llama wrap our array prompt awkwardly and frequently produce
  // malformed JSON (stray quotes, options-as-string, etc.). Our agents already
  // ask for JSON arrays via the prompt and parse via a `[...]` regex, so the
  // strict format flag adds breakage with no upside on this model.
  // If a future caller really needs strict object output, set
  // `options._forceJsonFormat` to re-enable.
  if (options._forceJsonFormat) {
    body.response_format = { type: 'json_object' };
  }

  const timeoutMs = options.timeoutMs || 180_000;

  const res = await axios.post(
    `${NVIDIA_BASE_URL}/chat/completions`,
    body,
    {
      headers: {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: timeoutMs,
      httpsAgent: nvidiaHttpsAgent,
    },
  );

  const content = res?.data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    const e = new Error('malformed_response');
    e.response = res;
    throw e;
  }
  return content;
}

/**
 * Private: existing Ollama path. Unchanged behavior — concurrency-queued,
 * cached, format-aware. Throws on any failure so the public router can
 * surface a clean error.
 */
async function ollamaGenerate(model, prompt, options = {}) {
  const timeoutMs = options.timeoutMs || 300_000;
  const numPredict = options.max_tokens || 4096;
  const format = options.format !== undefined ? options.format : 'json';

  await acquire();
  try {
    const body = {
      model,
      prompt,
      stream: false,
      keep_alive: KEEP_ALIVE,
      options: {
        temperature: options.temperature ?? 0.7,
        top_p: options.top_p ?? 0.9,
        num_predict: numPredict,
      },
    };
    if (format) body.format = format;

    const response = await axios.post(`${OLLAMA_URL}/api/generate`, body, {
      timeout: timeoutMs,
      httpAgent: ollamaHttpAgent,
    });
    return response.data.response;
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error(`AI request timed out after ${Math.round(timeoutMs / 1000)}s. Try fewer questions or a faster model.`);
    }
    console.error(`Ollama error (model: ${model}):`, error.message);
    throw new Error(`AI service unavailable: ${error.message}`);
  } finally {
    release();
  }
}

/**
 * Public: provider-routed completion. Tries NVIDIA NIM first when
 * NVIDIA_API_KEY is set, falls back to Ollama on any failure. The
 * agent-supplied `model` argument is used only for the Ollama path —
 * NVIDIA always uses NVIDIA_MODEL.
 *
 * @param {string} model — Ollama model name (e.g. 'qwen2.5:1.5b').
 * @param {string} prompt
 * @param {object} options — temperature, top_p, max_tokens, timeoutMs, format, cache, forceOllama
 * @returns {Promise<string>}
 */
async function generateCompletion(model, prompt, options = {}) {
  const useCache = options.cache !== false;
  const format = options.format !== undefined ? options.format : 'json';
  const numPredict = options.max_tokens || 4096;

  const tryNvidia = !!NVIDIA_API_KEY && !options.forceOllama;
  const nvidiaCacheKey = useCache && tryNvidia
    ? `nvidia::${NVIDIA_MODEL}::${format || 'text'}::${numPredict}::${prompt}`
    : null;
  const ollamaCacheKey = useCache
    ? `ollama::${model}::${format || 'text'}::${numPredict}::${prompt}`
    : null;

  // ── NVIDIA primary ─────────────────────────────────────────────
  if (tryNvidia) {
    if (nvidiaCacheKey) {
      const cached = cacheGet(nvidiaCacheKey);
      if (cached) return cached;
    }

    await nvidiaAcquire();
    try {
      let text;
      try {
        text = await nvidiaGenerate(prompt, options);
      } catch (err) {
        // One-shot retry without response_format if that was the cause.
        const klass = classifyNvidiaError(err);
        if (klass === 'json_format' && !options._skipJsonFormat) {
          text = await nvidiaGenerate(prompt, { ...options, _skipJsonFormat: true });
        } else {
          throw err;
        }
      }

      if (!nvidiaLoggedPrimaryOnce) {
        nvidiaLoggedPrimaryOnce = true;
        console.log(`[llm] NVIDIA primary: ${NVIDIA_MODEL}`);
      }
      nvidiaLastError = null;
      if (nvidiaCacheKey) cacheSet(nvidiaCacheKey, text);
      return text;
    } catch (err) {
      const klass = classifyNvidiaError(err);
      const status = err?.response?.status || err?.code || 'unknown';
      nvidiaLastError = { status, code: klass, message: err?.message || String(err), ts: new Date().toISOString() };
      if (!nvidiaLoggedFailureClasses.has(klass)) {
        nvidiaLoggedFailureClasses.add(klass);
        console.warn(`[llm] NVIDIA failed (status=${status}, code=${klass}) — falling back to Ollama. ${err?.message || ''}`);
      }
      // fall through to Ollama
    } finally {
      nvidiaRelease();
    }
  }

  // ── Ollama fallback (also primary when NVIDIA_API_KEY is empty) ────
  if (ollamaCacheKey) {
    const cached = cacheGet(ollamaCacheKey);
    if (cached) return cached;
  }
  const text = await ollamaGenerate(model, prompt, options);
  if (ollamaCacheKey) cacheSet(ollamaCacheKey, text);
  return text;
}

/**
 * Health check used by /api/health. Does NOT make a network call to
 * NVIDIA (would burn quota every health hit). Reports `configured` /
 * `unconfigured` from env, and `error` only when the last real call failed.
 */
async function checkHealth() {
  // Ollama probe — quick GET, 5s timeout.
  let ollama;
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`, { httpAgent: ollamaHttpAgent, timeout: 5000 });
    ollama = {
      status: 'connected',
      models: response.data.models?.map((m) => m.name) || [],
      queue: { inflight, waiting: queue.length, max: MAX_CONCURRENT },
      cache: { size: cache.size, max: CACHE_MAX },
    };
  } catch {
    ollama = { status: 'disconnected', models: [] };
  }

  const nvidia = NVIDIA_API_KEY
    ? {
        status: nvidiaLastError ? 'error' : 'configured',
        model: NVIDIA_MODEL,
        base_url: NVIDIA_BASE_URL,
        inflight: nvidiaInflight,
        waiting: nvidiaQueue.length,
        max: NVIDIA_MAX_CONCURRENT,
        last_error: nvidiaLastError,
      }
    : { status: 'unconfigured', model: NVIDIA_MODEL };

  let provider;
  if (nvidia.status === 'configured' && ollama.status === 'connected') provider = 'both';
  else if (nvidia.status === 'configured') provider = 'nvidia';
  else if (ollama.status === 'connected') provider = 'ollama';
  else provider = 'none';

  // Back-compat top-level fields so existing /api/health consumers
  // (e.g. scripts that read `data.ollama.status`) still work.
  return {
    status: ollama.status,
    models: ollama.models,
    queue: ollama.queue,
    cache: ollama.cache,
    provider,
    nvidia,
    ollama,
  };
}

module.exports = { generateCompletion, checkHealth, OLLAMA_URL };
