/**
 * SummaryAgent v2 — Lesson content summarizer
 * Returns structured bullet-point summaries for Indian engineering students
 */
const AgentBase = require('./agentBase');

class SummaryAgent extends AgentBase {
  constructor() {
    super('SummaryAgent', {
      primaryModel: 'claude',
      maxRetries: 2,
      baseTimeoutMs: 60_000,
      temperature: 0.25,
    });
  }

  buildPrompt(content, options = {}) {
    const { style = 'exam', maxPoints = 8 } = options;
    const maxChars = 2000;
    const truncated = content.length > maxChars ? content.substring(0, maxChars) + '...' : content;

    const styleGuides = {
      exam: 'Focus on exam-relevant definitions, formulas, and key concepts. Use terms a JNTU/VTU examiner would expect.',
      revision: 'Quick revision bullets. Include mnemonics and memory aids where helpful.',
      notes: 'Detailed study notes. Include examples and practical applications.',
    };
    const styleGuide = styleGuides[style] || styleGuides.exam;

    return `You are a study material creator for Indian engineering students (JNTU/VTU/Anna University).

${styleGuide}

Summarize this content in up to ${maxPoints} concise bullet points:

CONTENT:
${truncated}

Return ONLY valid JSON:
{
  "title": "Topic title inferred from content",
  "key_points": ["Key concept 1", "Key concept 2"],
  "important_terms": ["Term: definition"],
  "exam_tip": "One useful exam strategy tip"
}`;
  }

  validateResponse(parsed) {
    if (!Array.isArray(parsed.key_points) || parsed.key_points.length === 0) {
      throw new Error('Missing key_points array');
    }
    return true;
  }

  async summarize(content, options = {}) {
    if (!content?.trim()) throw new Error('Content is required');
    return super.generate([content, options], { maxTokens: 800 });
  }
}

module.exports = new SummaryAgent();
