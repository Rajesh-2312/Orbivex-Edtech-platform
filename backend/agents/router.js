/**
 * Assistant router — the fast front-line classifier.
 *
 * Runs on the cheap 'standard' (8B) tier and decides, in one small JSON call,
 * what the turn needs: which whitelisted tools to invoke (with arguments), and
 * a standalone rewrite of the question with pronouns resolved from history
 * ("how do they work?" → "how do pointers work?"). The heavy model is only
 * spent on the actual answer, not on this routing.
 *
 * The router NEVER executes anything — it only proposes. tools/index.js is the
 * sole gate that runs handlers, so a hallucinated tool name or a write without
 * confirmation is caught there, not here.
 */

const { generateCompletion } = require('../config/ai');
const { parseLooseJSON } = require('../utils/json');

const MAX_TOOL_CALLS = 3;

function buildRouterPrompt(message, history, toolSpecs) {
  const tools = toolSpecs
    .map((t) => `- ${t.name}${t.readOnly ? '' : ' (WRITE — needs confirmation)'}: ${t.description}\n    args: ${JSON.stringify(t.parameters.properties || {})}`)
    .join('\n');

  const historyText = (history || [])
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `You route a student's message on the Orbivex learning platform to the right tools.

AVAILABLE TOOLS:
${tools}

Decide:
1. "standalone_question": rewrite the student's message as a self-contained question, resolving pronouns from the conversation. If it is already standalone, repeat it.
2. "tools": the tools to call to fulfil the request, each { "name", "args" }. Choose only tools that clearly apply. Most turns need 0 or 1. Never invent a tool name or an argument the schema does not list. Leave empty [] for greetings, thanks, or a general knowledge question the tools do not cover.

Return ONLY JSON:
{"standalone_question": "...", "tools": [{"name": "...", "args": {...}}]}

${historyText ? `CONVERSATION:\n${historyText}\n` : ''}STUDENT MESSAGE: ${message}

JSON:`;
}

/**
 * @returns {Promise<{standalone_question: string, tools: Array<{name,args}>}>}
 */
async function route(message, history, toolSpecs) {
  const prompt = buildRouterPrompt(message, history, toolSpecs);

  let parsed = null;
  try {
    const raw = await generateCompletion('standard', prompt, {
      temperature: 0,
      max_tokens: 300,
      timeoutMs: 12_000,
      cache: false,
    });
    parsed = parseLooseJSON(raw);
  } catch (err) {
    console.warn(`[router] failed, proceeding with no tools: ${err.message}`);
  }

  // Degrade safely: if routing fails, answer as a plain grounded Q&A with the
  // original question and no tools rather than erroring the whole turn.
  if (!parsed || typeof parsed !== 'object') {
    return { standalone_question: message, tools: [] };
  }

  const valid = new Set(toolSpecs.map((t) => t.name));
  const tools = Array.isArray(parsed.tools)
    ? parsed.tools
        .filter((t) => t && valid.has(t.name))       // drop hallucinated names
        .slice(0, MAX_TOOL_CALLS)                     // bound latency/cost
        .map((t) => ({ name: t.name, args: t.args && typeof t.args === 'object' ? t.args : {} }))
    : [];

  const standalone = typeof parsed.standalone_question === 'string' && parsed.standalone_question.trim()
    ? parsed.standalone_question.trim()
    : message;

  return { standalone_question: standalone, tools };
}

module.exports = { route, buildRouterPrompt, MAX_TOOL_CALLS };
