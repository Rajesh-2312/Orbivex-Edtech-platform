const { generateCompletion } = require('../config/ai');

class GradingAgent {
  constructor() {
    this.model = 'claude';
    this.maxRetries = 1;
  }

  buildPrompt(assignmentText, rubric) {
    const truncated = assignmentText.length > 2000 ? assignmentText.substring(0, 2000) + '...' : assignmentText;

    return `Grade this student assignment based on the rubric.

RUBRIC: ${rubric}

SUBMISSION:
${truncated}

Return ONLY valid JSON, no other text:
{"score":85,"grade_letter":"B+","feedback":"Overall assessment","strengths":["Point 1"],"improvements":["Point 1"],"detailed_comments":"Brief feedback"}`;
  }

  async grade(assignmentText, rubric = 'clarity, accuracy, completeness, originality') {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await generateCompletion(
          this.model,
          this.buildPrompt(assignmentText, rubric),
          { temperature: 0.3, max_tokens: 1024, timeoutMs: 90_000 }
        );

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return JSON.parse(response);
      } catch (err) {
        lastError = err;
        console.warn(`GradingAgent attempt ${attempt + 1} failed:`, err.message);
      }
    }

    console.error('GradingAgent all retries exhausted');
    throw new Error('AI generated invalid grading format. Please try again.');
  }
}

module.exports = new GradingAgent();
