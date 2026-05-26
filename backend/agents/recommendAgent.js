const { generateCompletion } = require('../config/ollama');

class RecommendAgent {
  constructor() {
    this.model = process.env.OLLAMA_RECOMMEND_MODEL || process.env.OLLAMA_DEFAULT_MODEL || 'tinyllama';
    this.maxRetries = 1;
  }

  buildPrompt(completedLessons, availableCourses) {
    // Limit inputs to keep prompt short for lightweight model
    const recentLessons = completedLessons.slice(-10);
    const topCourses = availableCourses.slice(0, 10);

    return `Based on completed lessons, recommend next courses.

COMPLETED: ${recentLessons.join(', ')}

AVAILABLE:
${topCourses.map((c) => `- ${c.title} (${c.difficulty})`).join('\n')}

Return ONLY valid JSON, no other text:
{"recommendations":[{"course_title":"...","reason":"Why recommended","priority":"high"}],"learning_path_suggestion":"Brief narrative"}

priority: "high" or "medium" or "low"`;
  }

  async recommend(completedLessons, availableCourses) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await generateCompletion(
          this.model,
          this.buildPrompt(completedLessons, availableCourses),
          { temperature: 0.5, max_tokens: 1024, timeoutMs: 60_000 }
        );

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return JSON.parse(response);
      } catch (err) {
        lastError = err;
        console.warn(`RecommendAgent attempt ${attempt + 1} failed:`, err.message);
      }
    }

    console.error('RecommendAgent all retries exhausted');
    throw new Error('AI generated invalid recommendation format. Please try again.');
  }
}

module.exports = new RecommendAgent();
