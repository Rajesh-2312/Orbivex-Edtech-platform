const { generateCompletion } = require('../config/ollama');

class PlagiarismAgent {
  constructor() {
    this.model = process.env.OLLAMA_PLAGIARISM_MODEL || process.env.OLLAMA_DEFAULT_MODEL || 'tinyllama';
    this.maxRetries = 1;
  }

  buildPrompt(text) {
    const truncated = text.length > 2000 ? text.substring(0, 2000) + '...' : text;

    return `Analyze this text for plagiarism and AI-generation signs.

TEXT:
${truncated}

Return ONLY valid JSON, no other text:
{"plagiarism_score":15,"originality_score":85,"ai_generated_probability":20,"concerns":["Concern 1"],"recommendation":"pass","analysis":"Brief analysis"}

plagiarism_score: 0=original, 100=plagiarized. recommendation: "pass" or "review" or "fail"`;
  }

  async check(text) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await generateCompletion(
          this.model,
          this.buildPrompt(text),
          { temperature: 0.2, max_tokens: 512, timeoutMs: 60_000 }
        );

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return JSON.parse(response);
      } catch (err) {
        lastError = err;
        console.warn(`PlagiarismAgent attempt ${attempt + 1} failed:`, err.message);
      }
    }

    console.error('PlagiarismAgent all retries exhausted');
    throw new Error('AI generated invalid plagiarism report. Please try again.');
  }
}

module.exports = new PlagiarismAgent();
