/**
 * Orbivex AI config — OpenRouter + NVIDIA NIM, with automatic failover.
 *
 * Both providers expose an OpenAI-compatible /chat/completions endpoint, so
 * every agent keeps calling `generateCompletion(model, prompt, options)`
 * exactly as before — this module is the single chokepoint for all LLM calls.
 *
 * Call order is set by AI_PROVIDER_ORDER (default: openrouter,nvidia). Any
 * provider whose key is missing is skipped; if neither key is set, AI features
 * are disabled with a clear error.
 *
 * OpenRouter leads by default because NVIDIA's meta/llama-3.3-70b-instruct
 * stopped responding (connects, then never answers — burning the full request
 * timeout on every call before failover). Set AI_PROVIDER_ORDER=nvidia,openrouter
 * to put NIM back in front once it is healthy.
 *
 * Embeddings are NVIDIA-only regardless of this order — OpenRouter has no
 * embeddings endpoint — so NVIDIA_API_KEY is still required for tutor/RAG.
 *
 * Env:
 *   AI_PROVIDER_ORDER           — comma-separated, default openrouter,nvidia
 *   NVIDIA_API_KEY              — nvapi-... (also required for embeddings)
 *   NVIDIA_BASE_URL             — default https://integrate.api.nvidia.com/v1
 *   NVIDIA_MODEL                — default model id (e.g. meta/llama-3.3-70b-instruct)
 *   NVIDIA_MODEL_STANDARD       — "standard" tier model
 *   NVIDIA_MODEL_ADVANCED       — "advanced" tier model
 *
 *   OPENROUTER_API_KEY          — sk-or-...
 *   OPENROUTER_BASE_URL         — default https://openrouter.ai/api/v1
 *   OPENROUTER_MODEL            — default model id (e.g. meta-llama/llama-3.3-70b-instruct)
 *   OPENROUTER_MODEL_STANDARD   — "standard" tier model
 *   OPENROUTER_MODEL_ADVANCED   — "advanced" tier model
 */

const PROVIDERS = {
  nvidia: {
    name: 'nvidia',
    baseUrl: () => (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, ''),
    apiKey:  () => process.env.NVIDIA_API_KEY || '',
    defaultModel: () => process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct',
    tierModels: () => ({
      standard: process.env.NVIDIA_MODEL_STANDARD || 'meta/llama-3.1-8b-instruct',
      advanced: process.env.NVIDIA_MODEL_ADVANCED || 'meta/llama-3.3-70b-instruct',
    }),
    extraHeaders: () => ({}),
  },
  openrouter: {
    name: 'openrouter',
    baseUrl: () => (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
    apiKey:  () => process.env.OPENROUTER_API_KEY || '',
    defaultModel: () => process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct',
    tierModels: () => ({
      standard: process.env.OPENROUTER_MODEL_STANDARD || 'meta-llama/llama-3.1-8b-instruct',
      advanced: process.env.OPENROUTER_MODEL_ADVANCED || 'meta-llama/llama-3.3-70b-instruct',
    }),
    // Optional attribution headers recommended by OpenRouter
    extraHeaders: () => ({
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://orbivex.com',
      'X-Title': 'Orbivex',
    }),
  },
};

/* Friendly tier → concrete model id (resolved against the NVIDIA catalog by
   default; kept exported for the admin UI). */
const TIER_MODELS = PROVIDERS.nvidia.tierModels();

/**
 * Resolve whatever the agent passed (tier label, legacy local-model name, or
 * a real provider model id) down to a concrete model id for `provider`.
 *
 * - Tier labels ("standard" / "advanced") map per-provider.
 * - A raw id containing "/" is passed through only to the NVIDIA provider
 *   (agents hardcode NIM-style ids); OpenRouter always uses its own
 *   tier/default mapping since its catalog uses different id formats.
 * - Legacy names (phi3, mistral, qwen2.5:1.5b) fall back to the default.
 */
function resolveModel(model, provider = PROVIDERS.nvidia) {
  const tiers = provider.tierModels();
  if (!model) return provider.defaultModel();
  const key = String(model).toLowerCase();
  if (tiers[key]) return tiers[key];
  if (key.includes('/')) {
    return provider.name === 'nvidia' ? model : provider.defaultModel();
  }
  return provider.defaultModel();
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

// ── Provider circuit breaker ─────────────────────────────────────────────────
// The header of this file documents the failure that motivates this: a provider
// that connects but never answers, burning the full timeout on EVERY call before
// failover. Without a breaker, an outage makes every request slow. The breaker
// converts that to "one slow request, then the bad provider is skipped".
//
// States per provider:
//   closed    — normal; failures inside the window are counted
//   open      — recent failures exceeded the threshold; skip until cooldown ends
//   half-open — cooldown elapsed; allow ONE probe. Success closes it, failure
//               re-opens it for another cooldown.
const CB_THRESHOLD  = parseInt(process.env.AI_CB_THRESHOLD  || '3', 10);       // fails to open
const CB_WINDOW_MS  = parseInt(process.env.AI_CB_WINDOW_MS  || '60000', 10);   // fail-counting window
const CB_COOLDOWN_MS = parseInt(process.env.AI_CB_COOLDOWN_MS || '30000', 10); // open duration

const breakers = new Map(); // provider name → { fails: number[], openUntil }

function breakerFor(name) {
  if (!breakers.has(name)) breakers.set(name, { fails: [], openUntil: 0 });
  return breakers.get(name);
}

// Allowed unless fully open (within cooldown). Once cooldown elapses the
// provider is "half-open" — still allowed — and the next outcome decides its
// fate: a success closes it, a failure re-opens it.
function breakerAllows(name) {
  return Date.now() >= breakerFor(name).openUntil;
}

function breakerSuccess(name) {
  const b = breakerFor(name);
  b.fails = [];
  b.openUntil = 0;
}

function breakerFailure(name) {
  const b = breakerFor(name);
  const now = Date.now();
  if (b.openUntil !== 0) {
    // Was open; this attempt was the half-open probe — it failed, so cool down
    // again from scratch.
    b.openUntil = now + CB_COOLDOWN_MS;
    console.warn(`[ai] circuit re-opened for ${name} (probe failed); cooling down ${CB_COOLDOWN_MS}ms`);
    return;
  }
  b.fails = b.fails.filter((t) => now - t < CB_WINDOW_MS);
  b.fails.push(now);
  if (b.fails.length >= CB_THRESHOLD) {
    b.openUntil = now + CB_COOLDOWN_MS;
    console.warn(`[ai] circuit OPEN for ${name} (${b.fails.length} fails in window); skipping for ${CB_COOLDOWN_MS}ms`);
  }
}

function breakerState(name) {
  return Date.now() < breakerFor(name).openUntil ? 'open' : (breakerFor(name).fails.length ? 'degraded' : 'closed');
}

// ── Single-provider call (OpenAI-compatible chat endpoint) ──────────────────
async function callProvider(provider, model, prompt, { temperature, maxTokens, timeoutMs }) {
  const resolvedModel = resolveModel(model, provider);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${provider.baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...provider.extraHeaders(),
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
      throw new Error(`${provider.name} API ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error(`${provider.name} API: empty completion`);
    return text;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`${provider.name} API request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Single-provider streaming call (OpenAI-compatible SSE) ──────────────────
/**
 * Async generator yielding text deltas as they arrive. Same request shape as
 * callProvider but with stream:true, parsed from the `data: {...}` SSE frames
 * both providers emit. Throws on transport/HTTP error like callProvider does.
 */
async function* callProviderStream(provider, model, prompt, { temperature, maxTokens, timeoutMs }) {
  const resolvedModel = resolveModel(model, provider);
  const controller = new AbortController();
  // Idle-based timeout: a stream is healthy as long as tokens keep arriving, so
  // reset the timer on each chunk instead of capping total duration (a long
  // answer is not a hang).
  let timer = setTimeout(() => controller.abort(), timeoutMs);
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };

  try {
    const res = await fetch(`${provider.baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey()}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...provider.extraHeaders(),
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        top_p: 1,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${provider.name} API ${res.status}: ${body.slice(0, 300)}`);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of res.body) {
      resetTimer();
      buffer += decoder.decode(chunk, { stream: true });

      // SSE frames are newline-delimited; keep the trailing partial line.
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // keepalive comments and split frames — ignore
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`${provider.name} API stream stalled (>${timeoutMs}ms between tokens)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * streamCompletion — provider-failover streaming.
 *
 * Yields text deltas. Falls over to the next provider ONLY if the current one
 * fails before emitting any token; once output has begun, a mid-stream failure
 * is fatal because the consumer already holds a partial answer. Holds a
 * concurrency slot for the full stream duration.
 *
 * @returns {AsyncGenerator<string>}
 */
async function* streamCompletion(model, prompt, options = {}) {
  const providers = activeProviders(options.providerOrder);
  if (providers.length === 0) {
    throw new Error('No AI provider configured. Set NVIDIA_API_KEY and/or OPENROUTER_API_KEY in your environment variables.');
  }

  const maxTokens   = Math.min(options.max_tokens || 2048, 4096);
  const temperature = options.temperature !== undefined ? options.temperature : 0.3;
  const timeoutMs   = options.timeoutMs || 60_000;

  await acquire();
  try {
    let lastErr;
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      let started = false;
      try {
        for await (const delta of callProviderStream(provider, model, prompt, { temperature, maxTokens, timeoutMs })) {
          started = true;
          yield delta;
        }
        breakerSuccess(provider.name);
        return;
      } catch (err) {
        lastErr = err;
        // A failure only counts against the breaker if it happened before any
        // token — a mid-stream drop is not "provider unavailable".
        if (!started) breakerFailure(provider.name);
        if (started) throw err; // partial answer already delivered — cannot retry
        const next = providers[i + 1];
        if (next) console.warn(`[ai] ${provider.name} stream failed — falling back to ${next.name}. ${err.message}`);
      }
    }
    throw lastErr;
  } finally {
    release();
  }
}

const DEFAULT_PROVIDER_ORDER = ['openrouter', 'nvidia'];

/**
 * Ordered list of providers that currently have an API key configured.
 *
 * Order comes from `preferred` (per-call), else AI_PROVIDER_ORDER. Providers
 * omitted from the list are appended as fallbacks rather than dropped, so a
 * preference only reorders attempts — it never disables failover. Embeddings
 * ignore this entirely and always use NVIDIA (OpenRouter has no embeddings).
 *
 * @param preferred — array or comma-separated string of provider names
 */
function activeProviders(preferred) {
  const source = Array.isArray(preferred) ? preferred.join(',') : (preferred || process.env.AI_PROVIDER_ORDER || '');
  const configured = String(source)
    .split(',')
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);

  const order = configured.filter((n) => PROVIDERS[n]);
  for (const name of DEFAULT_PROVIDER_ORDER) {
    if (!order.includes(name)) order.push(name);
  }

  const keyed = order.map((n) => PROVIDERS[n]).filter((p) => p.apiKey());

  // Sink providers whose breaker is open to the end rather than removing them —
  // if every provider is open we must still try one (a half-open probe) instead
  // of failing outright. This is a stable partition, so preference order holds
  // within each group.
  const allowed = keyed.filter((p) => breakerAllows(p.name));
  const blocked = keyed.filter((p) => !breakerAllows(p.name));
  return [...allowed, ...blocked];
}

/**
 * generateCompletionDetailed — tries each active provider in order, falling
 * back to the next on failure, and reports which one actually answered.
 *
 * Use this when the caller needs to attribute the output (e.g. a
 * "generated by" label); use generateCompletion when only the text matters.
 *
 * @param {string} model    — tier label / model id (resolved via resolveModel)
 * @param {string} prompt
 * @param {object} options  — temperature, max_tokens, timeoutMs, cache,
 *                            providerOrder (per-call provider preference;
 *                            see activeProviders)
 * @returns {Promise<{text: string, provider: string, model: string}>}
 */
async function generateCompletionDetailed(model, prompt, options = {}) {
  const providers = activeProviders(options.providerOrder);
  if (providers.length === 0) {
    throw new Error('No AI provider configured. Set NVIDIA_API_KEY and/or OPENROUTER_API_KEY in your environment variables.');
  }

  const useCache    = options.cache !== false;
  const maxTokens   = Math.min(options.max_tokens || 2048, 4096);
  const temperature = options.temperature !== undefined ? options.temperature : 0.3;
  const timeoutMs   = options.timeoutMs || 60_000;
  const cacheKey    = useCache ? `llm::${model || 'default'}::${maxTokens}::${temperature}::${prompt}` : null;

  if (cacheKey) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  await acquire();
  try {
    let lastErr;
    for (const provider of providers) {
      try {
        const text = await callProvider(provider, model, prompt, { temperature, maxTokens, timeoutMs });
        breakerSuccess(provider.name);
        const result = { text, provider: provider.name, model: resolveModel(model, provider) };
        if (cacheKey) cacheSet(cacheKey, result);
        return result;
      } catch (err) {
        lastErr = err;
        breakerFailure(provider.name);
        const next = providers[providers.indexOf(provider) + 1];
        if (next) {
          console.warn(`[ai] ${provider.name} failed — falling back to ${next.name}. ${err.message}`);
        }
      }
    }
    throw lastErr;
  } finally {
    release();
  }
}

/**
 * generateCompletion — the text-only form every agent uses.
 * @returns {Promise<string>}
 */
async function generateCompletion(model, prompt, options = {}) {
  const { text } = await generateCompletionDetailed(model, prompt, options);
  return text;
}

/**
 * checkHealth — used by GET /api/health
 */
async function checkHealth() {
  const nvidiaConfigured     = !!PROVIDERS.nvidia.apiKey();
  const openrouterConfigured = !!PROVIDERS.openrouter.apiKey();
  // Roles follow the real call order rather than a fixed label, so health
  // reflects AI_PROVIDER_ORDER instead of contradicting it.
  const order = activeProviders().map((p) => p.name);
  const roleOf = (name) => {
    const i = order.indexOf(name);
    return i === -1 ? 'unused' : i === 0 ? 'primary' : 'fallback';
  };
  return {
    status: (nvidiaConfigured || openrouterConfigured) ? 'configured' : 'not_configured',
    order,
    providers: {
      nvidia:     { status: nvidiaConfigured ? 'configured' : 'not_configured', role: roleOf('nvidia'),     model: PROVIDERS.nvidia.defaultModel(), circuit: breakerState('nvidia') },
      openrouter: { status: openrouterConfigured ? 'configured' : 'not_configured', role: roleOf('openrouter'), model: PROVIDERS.openrouter.defaultModel(), circuit: breakerState('openrouter') },
    },
    inflight,
    waiting: waitQueue.length,
    max:     MAX_CONCURRENT,
    cache:   { size: cache.size, max: CACHE_MAX },
  };
}

module.exports = { generateCompletion, generateCompletionDetailed, streamCompletion, checkHealth, resolveModel, TIER_MODELS, breakerState };
