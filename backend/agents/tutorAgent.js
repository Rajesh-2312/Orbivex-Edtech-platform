/**
 * Orbivex Tutor — RAG-grounded lesson Q&A.
 *
 * Retrieval goes through utils/rag.js like every other agent, so improvements
 * to chunking, hybrid search and reranking land here automatically. This file
 * previously called match_lesson_chunks directly, which meant retrieval had to
 * be improved in two places.
 */

const { generateCompletion, streamCompletion } = require('../config/ai');
const { retrieveContext, buildContextBlock, topRelevance } = require('../utils/rag');
const { estimateTokens } = require('../utils/chunker');
const { verifyCitations } = require('./verifier');
const { healLessonIndex } = require('../utils/selfHeal');

// Tier labels, resolved per-provider in config/ai.js. 'advanced' is the 70B,
// 'standard' the 8B. This used to read 'claude', which no provider knows —
// resolveModel silently fell through to the default model.
const TUTOR_MODEL = 'advanced';

// Free "mini LLM" fast-path: a grounded lesson lookup ("what does ACID stand
// for", "define a pointer") is well within the 8B's reach — the sources do the
// heavy lifting, the model just phrases and cites them — so it goes to the fast
// tier. Reasoning-heavy questions (explain/why/compare/derive, or long/multi-part
// ones) still use the 70B. A pure heuristic, so simple questions pay NO extra
// classification call — that is the whole latency win. Disable with
// AI_TUTOR_FASTPATH=off.
const FASTPATH = (process.env.AI_TUTOR_FASTPATH || 'on').toLowerCase() !== 'off';

const REASONING_CUES = /\b(why|how|explain|compare|difference|differ|versus|vs|walk me through|step by step|prove|derive|trade[- ]?off|when should|advantages?|disadvantages?|relationship|reason)\b/i;

function pickTutorModel(question) {
  if (!FASTPATH) return TUTOR_MODEL;
  const q = String(question || '').trim();
  const words = q.split(/\s+/).length;
  // Reasoning cue, a long question, or multiple questions → the 70B.
  if (REASONING_CUES.test(q) || words > 18 || (q.match(/\?/g) || []).length > 1) {
    return 'advanced';
  }
  return 'standard';
}

const MAX_CHUNKS = 5;
const ANSWER_MAX_TOKENS = 800;

// History is bounded by a token budget, not a turn count: six terse turns and
// six paragraph-length turns cost wildly different amounts of context, and a
// fixed count lets the long case blow the window (pushing out the retrieved
// sources, which is what the answer actually depends on). Newest turns win.
const HISTORY_TOKEN_BUDGET = 1200;

/**
 * Below this the retrieved material does not actually answer the question, so
 * the tutor says so instead of padding with what the base model happens to
 * know. A confidently wrong definition is worse for a student than an honest
 * "not in your notes".
 *
 * Calibrated against real seeded content (2026-07-23): nv-embedqa cosine scores
 * are compressed — genuinely relevant chunks measured 0.34–0.54, while
 * off-topic queries return nothing at all (every chunk falls below the 0.3
 * retrieval floor). The two populations are cleanly separated with no overlap,
 * so the threshold sits at the floor: abstain when retrieval surfaces nothing,
 * answer when it surfaces anything. An earlier 0.4 cut through the middle of
 * the relevant range and abstained on real questions ("what is a for loop" →
 * 0.344).
 */
const MIN_RELEVANCE = 0.3;

const NO_CONTEXT_ANSWER =
  "I don't have this lesson's content indexed yet. Please ask your educator to refresh the lesson, or try again in a moment.";

function abstentionAnswer(question) {
  return `I couldn't find anything in this lesson that answers "${question.slice(0, 120)}". ` +
    `It may be covered in a different lesson — try rephrasing with the exact term from your notes, ` +
    `or ask your educator to add it.`;
}

/**
 * Take the most recent turns that fit in `budget` tokens, oldest-first in the
 * result. Walks newest→oldest so recent context is always kept; a single turn
 * larger than the whole budget is dropped rather than truncated mid-sentence.
 */
function packHistory(history, budget = HISTORY_TOKEN_BUDGET) {
  const kept = [];
  let used = 0;
  for (let i = (history || []).length - 1; i >= 0; i--) {
    const line = `${history[i].role === 'user' ? 'Student' : 'Tutor'}: ${history[i].content}`;
    const cost = estimateTokens(line);
    if (used + cost > budget && kept.length) break;
    if (cost > budget) continue;
    kept.unshift(line);
    used += cost;
  }
  return kept.join('\n');
}

function buildPrompt({ lessonTitle, contextBlock, history, question }) {
  const historyText = packHistory(history);

  return `You are an Orbivex study tutor for an Indian engineering student.
You ONLY answer using the SOURCES below from the lesson "${lessonTitle}".
If the answer is not present in the sources, say so plainly and suggest what the student should look up in the lesson.
Be concise (max ~150 words), use simple language, and end each fact with a bracketed citation like [1] or [2].

SOURCES:
${contextBlock}

${historyText ? `RECENT CONVERSATION:\n${historyText}\n` : ''}STUDENT QUESTION:
${question}

ANSWER (cite sources with [n]):`;
}

// Citation verification is shared with the assistant — see agents/verifier.js.
const stripInvalidCitations = (text, sourceCount) => verifyCitations(text, sourceCount).cleaned;

async function answer({ lessonId, userId, message, history }) {
  const prep = await prepare({ lessonId, message });
  if (prep.abstained) {
    return { answer: prep.answer, citations: [], abstained: true };
  }

  const raw = await generateCompletion(
    pickTutorModel(message),
    buildPrompt({
      lessonTitle: prep.lessonTitle,
      contextBlock: buildContextBlock(prep.chunks),
      history,
      question: message,
    }),
    {
      temperature: 0.2,
      max_tokens: ANSWER_MAX_TOKENS,
      timeoutMs: 90_000,
      cache: false, // every student turn is unique
    },
  );

  const { cleaned } = verifyCitations(String(raw || '').trim(), prep.chunks.length);
  return { answer: cleaned, citations: prep.citations, abstained: false };
}

/**
 * Retrieval + abstention shared by the buffered and streaming paths. Returns
 * either a ready-made abstention answer, or the context needed to generate one.
 */
async function prepare({ lessonId, message }) {
  if (!lessonId || !message) throw new Error('lessonId and message are required');

  const chunks = await retrieveContext(message, {
    source_type: 'lesson',
    source_id: lessonId,
    match_count: MAX_CHUNKS,
  });

  if (!chunks.length) {
    // Zero chunks has three meanings — distinguish them so the student gets an
    // honest message rather than a misleading "not indexed" for an off-topic ask.
    const { indexed, healing } = await healLessonIndex(lessonId);
    let answer;
    if (indexed) answer = abstentionAnswer(message);          // off-topic on an indexed lesson
    else if (healing) answer = "I'm indexing this lesson right now — give me a few seconds and ask again.";
    else answer = NO_CONTEXT_ANSWER;                          // genuinely empty/unindexed lesson
    return { abstained: true, answer, citations: [], chunks: [] };
  }
  if (topRelevance(chunks) < MIN_RELEVANCE) {
    return { abstained: true, answer: abstentionAnswer(message), citations: [], chunks: [] };
  }

  const citations = chunks.map((c, i) => ({
    n: i + 1,
    lesson_id: c.source_id,
    lesson_title: c.metadata?.lesson_title || null,
    heading_path: c.metadata?.heading_path || [],
    chunk_index: c.chunk_index,
    preview: String(c.content_chunk || '').slice(0, 180),
    similarity: typeof c.similarity === 'number' ? Number(c.similarity.toFixed(3)) : null,
    rerank_score: typeof c.rerank_score === 'number' ? c.rerank_score : null,
  }));

  return { abstained: false, chunks, citations, lessonTitle: chunks[0].metadata?.lesson_title || 'this lesson' };
}

/**
 * Streaming variant of answer(). Yields typed events so the route can forward
 * them as SSE and the UI can react before the answer is complete:
 *
 *   { type:'citations', citations }  — sources, emitted once up front
 *   { type:'token', value }          — a text delta
 *   { type:'done', answer, abstained } — final assembled answer
 *
 * Invalid citations are only knowable after the full text, so streamed tokens
 * are raw; the 'done' event carries the cleaned answer for persistence.
 */
async function* answerStream({ lessonId, userId, message, history }) {
  const prep = await prepare({ lessonId, message });

  if (prep.abstained) {
    yield { type: 'citations', citations: [] };
    yield { type: 'token', value: prep.answer };
    yield { type: 'done', answer: prep.answer, citations: [], abstained: true };
    return;
  }

  yield { type: 'citations', citations: prep.citations };

  const prompt = buildPrompt({
    lessonTitle: prep.lessonTitle,
    contextBlock: buildContextBlock(prep.chunks),
    history,
    question: message,
  });

  let raw = '';
  for await (const delta of streamCompletion(pickTutorModel(message), prompt, {
    temperature: 0.2,
    max_tokens: ANSWER_MAX_TOKENS,
    timeoutMs: 90_000,
  })) {
    raw += delta;
    yield { type: 'token', value: delta };
  }

  const { cleaned, uncitedFactual } = verifyCitations(raw.trim(), prep.chunks.length);
  yield {
    type: 'done',
    answer: cleaned,
    citations: prep.citations,
    abstained: false,
    // Signal the route to sample a groundedness score and expose a soft
    // "verify this" hint when a factual answer cited nothing.
    sources_block: buildContextBlock(prep.chunks),
    low_confidence: uncitedFactual,
  };
}

module.exports = { answer, answerStream, packHistory, pickTutorModel, TUTOR_MODEL, MIN_RELEVANCE, HISTORY_TOKEN_BUDGET, stripInvalidCitations };
