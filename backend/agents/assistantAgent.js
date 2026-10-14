/**
 * Orbivex platform assistant — orchestrates a single turn.
 *
 *   route → run read-only tools → answer grounded in the tool results
 *
 * Answers are grounded in tool output, which is the ground truth: the model
 * narrates the numbers a tool returned, it never computes them itself. Write
 * tools (enrol, bookmark) are never executed here — they are surfaced as a
 * confirmation the student must approve, then run via `confirmTool`.
 *
 * Emits typed events so the SSE route can forward them and the UI can show what
 * the assistant is doing as it happens:
 *
 *   { type:'status',  value }              — "Checking your progress…"
 *   { type:'tool',    name, ok, result }   — a tool ran (or failed)
 *   { type:'confirm', name, summary, args} — a write is awaiting approval
 *   { type:'citations', citations }        — lesson sources, when search ran
 *   { type:'token',   value }              — an answer delta
 *   { type:'done',    answer, ... }        — final assembled answer + trace
 */

const { streamCompletion } = require('../config/ai');
const { route } = require('./router');
const { toolSpecsFor, runTool } = require('./tools');
const { retrieveContext, topRelevance } = require('../utils/rag');
const { verifyCitations } = require('./verifier');

// A factual question with no grounding is where the model is free to invent —
// and, with a confusing history, to degenerate. Below this the fallback search
// found nothing usable, so we don't pretend we have sources.
const GROUND_MIN_RELEVANCE = 0.3;

const ANSWER_MODEL = 'advanced';
const ANSWER_MAX_TOKENS = 700;

const STATUS_BY_TOOL = {
  get_my_progress: 'Checking your progress…',
  list_my_courses: 'Looking up your courses…',
  search_lessons: 'Searching your lessons…',
  get_skill_gap: 'Reviewing your skill gaps…',
  get_coding_problems: 'Finding practice problems…',
  enroll_in_course: 'Preparing enrolment…',
};

function buildAnswerPrompt({ question, toolBlock, citationsBlock, history }) {
  const historyText = (history || [])
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `You are Orbivex's study assistant for an Indian engineering student.
Answer using the TOOL RESULTS and SOURCES below — these are the student's real data and course material. Do not invent numbers, course names, or facts that are not present. If the data does not cover the question, say so plainly.
Be concise and friendly (max ~150 words). When you cite lesson material, use a bracketed number like [1].

${toolBlock ? `TOOL RESULTS:\n${toolBlock}\n` : ''}${citationsBlock ? `SOURCES:\n${citationsBlock}\n` : ''}${historyText ? `RECENT CONVERSATION:\n${historyText}\n` : ''}STUDENT: ${question}

ANSWER:`;
}

/** Render tool results compactly for the answer prompt. */
function formatToolBlock(toolResults) {
  if (!toolResults.length) return '';
  return toolResults
    .map((t) => `[${t.name}] ${t.ok ? JSON.stringify(t.result) : `(failed: ${t.error})`}`)
    .join('\n');
}

/** search_lessons results become numbered citations the model can reference. */
function citationsFromTools(toolResults) {
  const search = toolResults.find((t) => t.name === 'search_lessons' && t.ok);
  if (!search?.result?.matches?.length) return [];
  return search.result.matches.map((m, i) => ({
    n: i + 1,
    lesson_title: m.lesson_title,
    heading_path: m.heading_path || [],
    preview: m.excerpt,
    similarity: m.similarity,
  }));
}

/**
 * Run one assistant turn.
 * @param {object} p
 * @param {object} p.user     — { id, role, email }
 * @param {string} p.message
 * @param {Array}  p.history
 * @returns {AsyncGenerator}
 */
async function* answerStream({ user, message, history }) {
  const specs = toolSpecsFor(user);

  yield { type: 'status', value: 'Thinking…' };
  const plan = await route(message, history, specs);

  const toolResults = [];
  let pendingConfirm = null;

  for (const call of plan.tools) {
    yield { type: 'status', value: STATUS_BY_TOOL[call.name] || `Running ${call.name}…` };
    const res = await runTool(call.name, call.args, user);

    if (res.needs_confirmation) {
      // Stop at the first write and ask — do not run further tools speculatively.
      pendingConfirm = { name: res.name, args: res.args, summary: res.summary };
      yield { type: 'confirm', name: res.name, summary: res.summary, args: res.args };
      break;
    }
    yield { type: 'tool', name: res.name, ok: res.ok, result: res.ok ? res.result : null, error: res.error || null };
    toolResults.push(res);
  }

  // A pending write is a full turn: the assistant asks, the student approves
  // later via confirmTool. Nothing to generate now.
  if (pendingConfirm) {
    const ask = pendingConfirm.summary || 'Do you want me to go ahead?';
    yield { type: 'token', value: ask };
    yield {
      type: 'done',
      answer: ask,
      citations: [],
      tool_calls: toolResults.map((t) => ({ name: t.name, ok: t.ok, ms: t.ms })),
      pending_confirmation: pendingConfirm,
    };
    return;
  }

  let citations = citationsFromTools(toolResults);

  // If nothing grounded this turn but the router still wants an answer, fall
  // back to a lesson search on the rewritten question. This keeps the assistant
  // grounded on factual questions the router failed to route — the ungrounded
  // path is where the model is free to invent or degenerate. Pure smalltalk
  // ("thanks") simply retrieves nothing relevant and answers briefly.
  if (!citations.length && !toolResults.length) {
    yield { type: 'status', value: 'Searching your lessons…' };
    try {
      const chunks = await retrieveContext(plan.standalone_question, { source_type: 'lesson', match_count: 5 });
      if (topRelevance(chunks) >= GROUND_MIN_RELEVANCE) {
        citations = chunks.map((c, i) => ({
          n: i + 1,
          lesson_title: c.metadata?.lesson_title || null,
          heading_path: c.metadata?.heading_path || [],
          preview: String(c.content_chunk || '').slice(0, 300),
          similarity: typeof c.similarity === 'number' ? Number(c.similarity.toFixed(3)) : null,
        }));
      }
    } catch (err) {
      console.warn(`[assistant] fallback search failed: ${err.message}`);
    }
  }

  yield { type: 'citations', citations };

  yield { type: 'status', value: 'Writing…' };
  const prompt = buildAnswerPrompt({
    question: plan.standalone_question,
    toolBlock: formatToolBlock(toolResults),
    citationsBlock: citations.map((c) => `[${c.n}] (${c.lesson_title || 'lesson'}) ${c.preview}`).join('\n\n'),
    history,
  });

  let raw = '';
  for await (const delta of streamCompletion(ANSWER_MODEL, prompt, {
    temperature: 0.2,
    max_tokens: ANSWER_MAX_TOKENS,
    timeoutMs: 90_000,
  })) {
    raw += delta;
    yield { type: 'token', value: delta };
  }

  // A tool-backed answer is grounded in structured tool output (ground truth),
  // so only run citation verification when the grounding was lesson SOURCES.
  const sourcesBlock = citations.map((c) => `[${c.n}] (${c.lesson_title || 'lesson'}) ${c.preview}`).join('\n\n');
  const { cleaned, uncitedFactual } = verifyCitations(raw.trim(), citations.length);

  yield {
    type: 'done',
    answer: cleaned,
    citations,
    tool_calls: toolResults.map((t) => ({ name: t.name, ok: t.ok, ms: t.ms })),
    sources_block: sourcesBlock,
    // Only flag low confidence for source-grounded answers; a tool answer with
    // no lesson citations is expected, not suspicious.
    low_confidence: citations.length > 0 && uncitedFactual,
  };
}

/**
 * Execute a previously-proposed write after the student confirms it.
 * @returns {Promise<{ok, result?, error?}>}
 */
async function confirmTool({ user, name, args }) {
  const res = await runTool(name, args, user, { confirmed: true });
  return { ok: res.ok, result: res.result || null, error: res.error || null };
}

module.exports = { answerStream, confirmTool };
