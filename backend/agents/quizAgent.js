const { generateCompletion } = require('../config/ollama');

class QuizAgent {
  constructor() {
    this.model = process.env.OLLAMA_QUIZ_MODEL || process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:1.5b';
    this.maxRetries = 1; // format:'json' makes parse failures rare; cut wasted retries
  }

  buildPrompt(content, numQuestions) {
    // Truncate content to keep prompt small for lightweight model
    const truncated = content.length > 1500 ? content.substring(0, 1500) + '...' : content;

    return `Generate ${numQuestions} multiple-choice quiz questions from this content.

CONTENT:
${truncated}

Return ONLY a valid JSON array, no other text:
[{"question":"What is...?","options":["A) ...","B) ...","C) ...","D) ..."],"correct_answer":"A","explanation":"Brief reason"}]`;
  }

  async generate(content, numQuestions = 3) {
    // Cap questions for lightweight model to avoid quality degradation
    numQuestions = Math.min(numQuestions, 5);
    const maxTokens = Math.max(1024, numQuestions * 400);
    const timeoutMs = Math.max(60_000, numQuestions * 30_000);

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await generateCompletion(
          this.model,
          this.buildPrompt(content, numQuestions),
          { temperature: 0.3, max_tokens: maxTokens, timeoutMs }
        );

        // Strip markdown code fences if present
        const stripped = response.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
        const jsonMatch = stripped.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        const parsed = JSON.parse(stripped);
        if (Array.isArray(parsed)) return parsed;
        throw new Error('Response is not a JSON array');
      } catch (err) {
        lastError = err;
        console.warn(`QuizAgent attempt ${attempt + 1} failed:`, err.message);
      }
    }

    console.error('QuizAgent all retries exhausted');
    throw new Error('AI generated invalid quiz format. Please try again.');
  }
}

module.exports = new QuizAgent();
