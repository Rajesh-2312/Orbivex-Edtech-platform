/**
 * Answer verification — the hallucination-control layer.
 *
 * Two independent checks, neither trusted alone:
 *
 *   verifyCitations()  — deterministic, synchronous, free. Strips citation
 *                        markers that point at sources the model was never
 *                        given (a fabricated [7] against 5 sources), and flags
 *                        a factual-looking answer that cites nothing at all.
 *
 *   scoreGroundedness() — an LLM judge, run async/sampled AFTER the answer has
 *                        streamed. It cannot block a streamed answer (the
 *                        student already saw it), so it is a metric written to
 *                        tutor_messages.grounded_score, not a gate. It feeds the
 *                        eval and selects Phase 6 training data.
 */

const { generateCompletion } = require('../config/ai');
const { parseLooseJSON } = require('../utils/json');
const { supabaseAdmin } = require('../config/supabase');

/**
 * A sentence "looks factual" if it makes a claim a student could act on — i.e.
 * it is not a greeting, a hedge, or a meta-comment. Used only to decide whether
 * a citation-free answer is suspicious, so false positives just mean a slightly
 * lower confidence flag, never a wrong answer.
 */
const NON_FACTUAL = /^(hi|hello|hey|thanks|thank you|sure|okay|ok|got it|i'm|i am|let me|happy to|glad to|no problem|you're|you are welcome)\b/i;

/**
 * @param {string} answer
 * @param {number} sourceCount — how many sources the model was shown
 * @returns {{ cleaned: string, invalidCitations: number, citedCount: number, uncitedFactual: boolean }}
 */
function verifyCitations(answer, sourceCount) {
  const text = String(answer || '');
  const cited = new Set();
  let invalid = 0;

  const cleaned = text.replace(/\[(\d+)\]/g, (match, n) => {
    const num = Number(n);
    if (num >= 1 && num <= sourceCount) { cited.add(num); return match; }
    invalid++;
    return '';
  }).replace(/[ \t]{2,}/g, ' ').replace(/ +([.,;:])/g, '$1');

  // Did the answer make factual claims but cite nothing, when sources existed?
  const sentences = cleaned.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const factualSentences = sentences.filter((s) => s.length > 25 && !NON_FACTUAL.test(s));
  const uncitedFactual = sourceCount > 0 && cited.size === 0 && factualSentences.length > 0;

  return { cleaned, invalidCitations: invalid, citedCount: cited.size, uncitedFactual };
}

/**
 * LLM-judge groundedness: what fraction of the answer's claims are supported by
 * the sources. Returns null on any failure (never throws into the caller — it
 * is a best-effort metric).
 *
 * @returns {Promise<number|null>} 0..1, or null if unavailable
 */
async function scoreGroundedness(answer, sourcesBlock) {
  if (!answer?.trim() || !sourcesBlock?.trim()) return null;

  const prompt = `You are a strict grader. Given SOURCES and an ANSWER, judge what fraction of the ANSWER's factual claims are directly supported by the SOURCES.
1.0 = every claim is supported. 0.0 = none are. Ignore greetings and hedges.

Return ONLY JSON: {"supported": <int>, "total": <int>}

SOURCES:
${sourcesBlock}

ANSWER:
${answer}

JSON:`;

  try {
    const raw = await generateCompletion('standard', prompt, {
      temperature: 0,
      max_tokens: 60,
      timeoutMs: 12_000,
      cache: false,
    });
    const parsed = parseLooseJSON(raw);
    const total = Number(parsed?.total);
    const supported = Number(parsed?.supported);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(supported)) return null;
    return Math.max(0, Math.min(1, supported / total));
  } catch (err) {
    console.warn(`[verifier] groundedness scoring failed: ${err.message}`);
    return null;
  }
}

/**
 * Should this turn be groundedness-scored? Always score thumbs-down turns (done
 * elsewhere); otherwise sample, to bound cost. Deterministic per call via
 * Math.random so the route stays simple.
 */
function shouldScore(sampleRate = 0.15) {
  return Math.random() < sampleRate;
}

/**
 * Fire-and-forget: score a persisted answer's groundedness and write it back to
 * tutor_messages.grounded_score. Runs AFTER the answer has streamed, so it never
 * adds latency to the student's turn. Skips unless sampled (or `always`, used
 * for low-confidence answers and thumbs-down turns).
 *
 * Never rejects — a scoring failure must not surface anywhere.
 */
function scoreAndPersistGroundedness(messageId, answer, sourcesBlock, { always = false, sampleRate = 0.15 } = {}) {
  if (!messageId || !sourcesBlock?.trim()) return;
  if (!always && !shouldScore(sampleRate)) return;

  // Detached — the route has already responded.
  (async () => {
    const score = await scoreGroundedness(answer, sourcesBlock);
    if (score === null) return;
    await supabaseAdmin
      .from('tutor_messages')
      .update({ grounded_score: score })
      .eq('id', messageId);
  })().catch((err) => console.warn(`[verifier] scoreAndPersist failed: ${err.message}`));
}

module.exports = { verifyCitations, scoreGroundedness, shouldScore, scoreAndPersistGroundedness };
