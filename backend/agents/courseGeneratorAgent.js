const { generateCompletion } = require('../config/ollama');

class CourseGeneratorAgent {
  constructor() {
    this.model = process.env.OLLAMA_COURSE_MODEL || process.env.OLLAMA_DEFAULT_MODEL || 'tinyllama';
    this.maxRetries = 1;
  }

  buildPrompt(subject, { difficulty = 'beginner', numLessons = 4, audience = 'undergraduate students' } = {}) {
    return `Generate a ${difficulty} course on "${subject}" for ${audience} with ${numLessons} lessons.

Return ONLY valid JSON, no other text:
{"title":"Course title","description":"Short description","category":"technical","difficulty":"${difficulty}","lessons":[{"title":"Lesson 1","description":"Summary","content_text":"100 word lesson body","duration_minutes":15}]}`;
  }

  async generate(subject, options = {}) {
    if (!subject || !subject.trim()) {
      throw new Error('subject is required');
    }

    // Cap lessons for lightweight model
    if (options.numLessons) {
      options.numLessons = Math.min(options.numLessons, 6);
    }

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await generateCompletion(
          this.model,
          this.buildPrompt(subject, options),
          { temperature: 0.4, max_tokens: 2048, timeoutMs: 120_000 }
        );

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);

        if (!parsed.title || !Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
          throw new Error('missing title or lessons');
        }
        return parsed;
      } catch (err) {
        lastError = err;
        console.warn(`CourseGeneratorAgent attempt ${attempt + 1} failed:`, err.message);
      }
    }

    console.error('CourseGeneratorAgent all retries exhausted');
    throw new Error('AI generated invalid course format. Please try again.');
  }
}

module.exports = new CourseGeneratorAgent();
