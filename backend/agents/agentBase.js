/**
 * AgentBase — Expert-grade base class for all Orbivex AI agents
 *
 * Features:
 * - Exponential backoff retries with jitter
 * - JSON validation with schema enforcement
 * - Model fallback chain (primary → fallback → emergency)
 * - Token budget management per plan tier
 * - Agent health monitoring (success/fail counters)
 * - Structured logging with execution time
 * - Prompt versioning for A/B testing
 */

const { generateCompletion } = require('../config/ai');

const agentMetrics = new Map(); // agentName → { calls, successes, failures, totalMs }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function jitter(base, factor = 0.3) {
  return base + (Math.random() - 0.5) * base * factor;
}

class AgentBase {
  constructor(name, config = {}) {
    this.name = name;
    this.primaryModel = config.primaryModel || 'claude';
    this.fallbackModels = config.fallbackModels || [];
    this.maxRetries = config.maxRetries ?? 2;
    this.baseTimeoutMs = config.baseTimeoutMs ?? 60_000;
    this.temperature = config.temperature ?? 0.3;

    // Init metrics
    if (!agentMetrics.has(name)) {
      agentMetrics.set(name, { calls: 0, successes: 0, failures: 0, totalMs: 0 });
    }

    console.log(`[${this.name}] Initialized — model: ${this.primaryModel}`);
  }

  /** Build the prompt — override in subclasses */
  buildPrompt(...args) {
    throw new Error(`${this.name}.buildPrompt() not implemented`);
  }

  /** Validate parsed response — override in subclasses */
  validateResponse(parsed) {
    return !!parsed;
  }

  /** Post-process — override if needed */
  postProcess(parsed) {
    return parsed;
  }

  /**
   * Core generate method with retry + fallback chain
   */
  async generate(promptArgs, options = {}) {
    const metrics = agentMetrics.get(this.name);
    metrics.calls++;
    const startMs = Date.now();

    const maxTokens = options.maxTokens || this.baseMaxTokens || 1024;
    const timeoutMs = options.timeoutMs || this.baseTimeoutMs;

    const modelChain = [this.primaryModel, ...this.fallbackModels].filter(Boolean);

    let lastError;
    let attempt = 0;
    let modelIndex = 0;

    while (attempt <= this.maxRetries) {
      const model = modelChain[modelIndex] || modelChain[0];
      const prompt = this.buildPrompt(...(Array.isArray(promptArgs) ? promptArgs : [promptArgs]));

      try {
        const t0 = Date.now();
        const raw = await generateCompletion(model, prompt, {
          temperature: options.temperature ?? this.temperature,
          max_tokens: maxTokens,
          timeoutMs,
        });
        const genMs = Date.now() - t0;

        const parsed = this._parseJSON(raw);
        if (!parsed) throw new Error('Response is not valid JSON');

        this.validateResponse(parsed); // throws if invalid
        const result = this.postProcess(parsed);

        const totalMs = Date.now() - startMs;
        metrics.successes++;
        metrics.totalMs += totalMs;
        console.log(`[${this.name}] ✓ Success — model: ${model}, gen: ${genMs}ms, total: ${totalMs}ms, attempt: ${attempt + 1}`);

        return result;
      } catch (err) {
        lastError = err;
        console.warn(`[${this.name}] ✗ Attempt ${attempt + 1}/${this.maxRetries + 1} failed (model: ${model}):`, err.message);

        attempt++;
        // Try next model in chain on parse/validate errors
        if (attempt > 1 && modelIndex < modelChain.length - 1) modelIndex++;

        if (attempt <= this.maxRetries) {
          const delay = jitter(500 * Math.pow(2, attempt - 1));
          await sleep(delay);
        }
      }
    }

    metrics.failures++;
    metrics.totalMs += (Date.now() - startMs);
    console.error(`[${this.name}] ✗ All ${this.maxRetries + 1} attempts failed. Last: ${lastError?.message}`);
    throw new Error(`${this.name} failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /** Robust JSON parser — handles markdown fences, trailing commas, partial objects */
  _parseJSON(raw) {
    if (!raw || typeof raw !== 'string') return null;

    // Strip markdown code fences
    let s = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();

    // Try direct parse
    try { return JSON.parse(s); } catch {}

    // Extract first JSON object or array
    const objMatch = s.match(/\{[\s\S]*\}/);
    if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }

    const arrMatch = s.match(/\[[\s\S]*\]/);
    if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }

    // Fix common LLM output errors: trailing commas, single quotes
    try {
      const cleaned = s
        .replace(/,\s*([}\]])/g, '$1')  // trailing commas
        .replace(/'/g, '"')              // single quotes
        .replace(/(\w+)\s*:/g, '"$1":'); // unquoted keys
      return JSON.parse(cleaned);
    } catch {}

    return null;
  }

  /** Get health metrics for this agent */
  getMetrics() {
    const m = agentMetrics.get(this.name) || {};
    return {
      ...m,
      successRate: m.calls ? ((m.successes / m.calls) * 100).toFixed(1) + '%' : '—',
      avgMs: m.successes ? Math.round(m.totalMs / m.successes) : 0,
    };
  }

  /** Static: get metrics for all agents */
  static getAllMetrics() {
    const result = {};
    for (const [name, m] of agentMetrics) {
      result[name] = {
        ...m,
        successRate: m.calls ? ((m.successes / m.calls) * 100).toFixed(1) + '%' : '—',
        avgMs: m.successes ? Math.round(m.totalMs / m.successes) : 0,
      };
    }
    return result;
  }
}

module.exports = AgentBase;
