/**
 * Tolerant JSON parsing for LLM output.
 *
 * Small models routinely emit *almost* JSON — wrapped in markdown fences, with
 * a trailing comma, or simply truncated before the closing brace. Every agent
 * needs the same recovery, so it lives here rather than being reimplemented per
 * agent (AgentBase and the RAG reranker both use it).
 *
 * Returns null when nothing salvageable is found — callers decide whether to
 * retry or degrade.
 */

/**
 * Extract the first balanced {...} or [...] region, repairing an unterminated
 * one by appending the closers it is missing. This is what recovers the common
 * `{"scores":[{"i":1,"s":8}]` truncation, which no regex can fix.
 */
function extractBalanced(text) {
  const start = text.search(/[{[]/);
  if (start === -1) return null;

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      stack.pop();
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }

  // Ran out of input mid-structure — close what is still open, innermost first.
  if (stack.length) {
    const closers = stack.reverse().map((c) => (c === '{' ? '}' : ']')).join('');
    return text.slice(start).replace(/,\s*$/, '') + closers;
  }
  return null;
}

/**
 * @param {string} raw
 * @returns {any|null}
 */
function parseLooseJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();

  try { return JSON.parse(stripped); } catch { /* keep going */ }

  const balanced = extractBalanced(stripped);
  if (balanced) {
    try { return JSON.parse(balanced); } catch { /* keep going */ }

    // Trailing commas are the next most common defect.
    try { return JSON.parse(balanced.replace(/,\s*([}\]])/g, '$1')); } catch { /* keep going */ }
  }

  // Last resort: single-quoted strings and unquoted keys. Applied last because
  // it corrupts apostrophes inside otherwise valid string values.
  const target = balanced || stripped;
  try {
    return JSON.parse(
      target
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/'/g, '"')
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'),
    );
  } catch { /* give up */ }

  return null;
}

module.exports = { parseLooseJSON, extractBalanced };
