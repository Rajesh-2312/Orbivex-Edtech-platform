/**
 * QuizAgent v2 — Expert-grade MCQ quiz generation
 * Built on AgentBase with Indian engineering curriculum awareness.
 * Uses RAG to pull similar existing questions as few-shot examples so the
 * model avoids duplicating questions already in the bank.
 */
const AgentBase = require('./agentBase');
const { retrieveContext, buildContextBlock } = require('../utils/rag');

class QuizAgent extends AgentBase {
  constructor() {
    super('QuizAgent', {
      primaryModel: 'claude',
      maxRetries: 2,
      baseTimeoutMs: 90_000,
      temperature: 0.3,
    });
    this.baseMaxTokens = 1500;
  }

  buildPrompt(content, numQuestions, existingQContext = '') {
    // Truncate content sensibly — preserve sentence boundaries
    const maxChars = 1800;
    let truncated = content;
    if (content.length > maxChars) {
      truncated = content.substring(0, maxChars);
      const lastPeriod = truncated.lastIndexOf('.');
      if (lastPeriod > maxChars * 0.6) truncated = truncated.substring(0, lastPeriod + 1);
      truncated += '\n[Content truncated]';
    }

    const avoidSection = existingQContext
      ? `\nAVOID duplicating these existing questions (paraphrase topics differently):\n${existingQContext}\n`
      : '';

    return `You are an expert quiz creator for Indian engineering students (JNTU/VTU/Anna University syllabus).

Generate exactly ${numQuestions} multiple-choice quiz questions from the content below.

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- One correct answer per question
- Brief explanation (1-2 sentences) for the correct answer
- Mix difficulty: easy (30%), medium (50%), hard (20%)
- Focus on conceptual understanding, not rote memorization
- Use Indian context where relevant
${avoidSection}
CONTENT:
${truncated}

Return ONLY a valid JSON array, no other text:
[{"question":"What is...?","options":["A) Option","B) Option","C) Option","D) Option"],"correct_answer":"B","explanation":"Because...","difficulty":"medium"}]`;
  }

  validateResponse(parsed) {
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Response must be a non-empty JSON array');
    }
    for (const q of parsed) {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || !q.correct_answer) {
        throw new Error(`Invalid question structure: ${JSON.stringify(q).substring(0, 100)}`);
      }
    }
    return true;
  }

  async generate(content, numQuestions = 3, options = {}) {
    numQuestions = Math.min(Math.max(numQuestions, 1), 10);
    const maxTokens = Math.max(1024, numQuestions * 350);
    const timeoutMs = Math.max(60_000, numQuestions * 25_000);

    // RAG: pull existing similar questions so the model avoids duplication
    let existingQContext = '';
    try {
      const similar = await retrieveContext(content.slice(0, 300), {
        source_type: 'question',
        course_id: options.course_id || null,
        match_count: 6,
        threshold: 0.45,
      });
      existingQContext = similar.map(c => `- ${c.content_chunk}`).join('\n');
    } catch { /* RAG unavailable — continue without it */ }

    return super.generate([content, numQuestions, existingQContext], { maxTokens, timeoutMs });
  }
}

module.exports = new QuizAgent();
