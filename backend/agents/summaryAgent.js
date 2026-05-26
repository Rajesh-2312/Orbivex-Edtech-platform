const { generateCompletion } = require('../config/ollama');

class SummaryAgent {
  constructor() {
    this.model = process.env.OLLAMA_SUMMARY_MODEL || process.env.OLLAMA_DEFAULT_MODEL || 'tinyllama';
    this.maxRetries = 1;
  }

  buildPrompt(content) {
    const truncated = content.length > 2000 ? content.substring(0, 2000) + '...' : content;

    return `Summarize this lesson into key points for student review.

CONTENT:
${truncated}

Return ONLY valid JSON, no other text:
{"summary":"2-3 sentence overview","key_points":["Point 1","Point 2","Point 3"],"vocabulary":["Term: definition"],"difficulty_level":"beginner"}

difficulty_level: "beginner" or "intermediate" or "advanced"`;
  }

  async summarize(content) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await generateCompletion(
          this.model,
          this.buildPrompt(content),
          { temperature: 0.3, max_tokens: 768, timeoutMs: 60_000 }
        );

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return JSON.parse(response);
      } catch (err) {
        lastError = err;
        console.warn(`SummaryAgent attempt ${attempt + 1} failed:`, err.message);
      }
    }

    console.error('SummaryAgent all retries exhausted');
    throw new Error('AI generated invalid summary format. Please try again.');
  }
}

module.exports = new SummaryAgent();
