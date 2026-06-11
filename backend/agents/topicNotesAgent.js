const { generateCompletion } = require('../config/ai');

/**
 * Generates structured study notes for a placement-prep topic at one of
 * five learning paces:
 *   1 = Beginner    — slowest, full hand-holding, zero prior knowledge
 *   2 = Easy        — slow pace with structured walkthrough
 *   3 = Standard    — balanced default for an average engineering student
 *   4 = Advanced    — fast pace, focuses on tricks and edge cases
 *   5 = Expert      — sprint mode, terse formula reference + tricky example
 *
 * Output JSON shape:
 *   {
 *     overview, key_concepts: [{concept, explanation}],
 *     formulas[], example: {problem, solution},
 *     tips[], common_mistakes[]
 *   }
 */

const PACE_GUIDE = {
  1: {
    label: 'Beginner',
    style: 'Assume the student has zero prior knowledge of this topic. Use very simple language and define every term. Walk through reasoning step by step.',
    counts: '5-6 key_concepts, 0-3 formulas, very detailed step-by-step example, 4 tips, 4 common_mistakes',
    chars: '2-3 sentences per explanation, full sentences in the solution',
  },
  2: {
    label: 'Easy',
    style: 'Student has seen this topic before but is not confident. Provide a clear structured walkthrough with simple wording.',
    counts: '4-5 key_concepts, 0-3 formulas, clear example with intermediate steps, 3-4 tips, 3-4 common_mistakes',
    chars: 'Up to 2 sentences per explanation',
  },
  3: {
    label: 'Standard',
    style: 'Balanced for an average engineering student preparing for placements. Concise but complete.',
    counts: '3-4 key_concepts, 0-4 formulas, one solid example, 2-4 tips, 2-4 common_mistakes',
    chars: 'Up to 240 characters per string',
  },
  4: {
    label: 'Advanced',
    style: 'Student has practiced similar problems. Skip basics. Focus on tricks, shortcuts, and edge cases that come up in real interviews.',
    counts: '3 key_concepts (advanced angles only), 1-4 sharp formulas, one harder example, 3 pro tips, 3 subtle pitfalls',
    chars: 'Tight, dense lines — under 200 characters each',
  },
  5: {
    label: 'Expert',
    style: 'Sprint mode for a confident student. Just the high-signal stuff — no introduction, no definitions of basic terms.',
    counts: '2-3 razor-sharp key_concepts, the absolute must-know formulas only, one tricky example, 2-3 elite tips, 2-3 traps to avoid',
    chars: 'Telegraphic — under 160 characters each',
  },
};

class TopicNotesAgent {
  constructor() {
    this.model = 'claude';
    this.maxRetries = 1;
  }

  buildPrompt({ topic, company, roundTitle, paceLevel }) {
    const guide = PACE_GUIDE[paceLevel] || PACE_GUIDE[3];

    return `You are a placement-preparation tutor. Write study notes for an Indian engineering student preparing for ${company}'s ${roundTitle} round.

TOPIC: ${topic}
PACE: ${paceLevel} of 5 — ${guide.label}
STYLE: ${guide.style}
SHAPE: ${guide.counts}
LENGTH: ${guide.chars}

Return ONLY valid JSON, no other text. Match this exact structure:
{"overview":"intro tuned to the pace above","key_concepts":[{"concept":"Name","explanation":"Explanation tuned to pace"}],"formulas":["formula 1"],"example":{"problem":"A worked problem","solution":"Step-by-step solution"},"tips":["Tip 1"],"common_mistakes":["Mistake 1"]}

Hard rules:
- Output MUST be valid JSON, no markdown fences
- formulas can be an empty array if not applicable
- example must be a single concrete worked problem, not abstract`;
  }

  async generate({ topic, company, roundTitle, paceLevel = 3 }) {
    const pace = Number(paceLevel);
    const safePace = pace >= 1 && pace <= 5 ? pace : 3;
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await generateCompletion(
          this.model,
          this.buildPrompt({ topic, company, roundTitle, paceLevel: safePace }),
          { temperature: 0.4, max_tokens: 1024, timeoutMs: 90_000 }
        );

        const stripped = response.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
        const jsonMatch = stripped.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(stripped);

        const notes = {
          overview: String(parsed.overview || '').trim(),
          key_concepts: Array.isArray(parsed.key_concepts) ? parsed.key_concepts : [],
          formulas: Array.isArray(parsed.formulas) ? parsed.formulas : [],
          example: parsed.example && typeof parsed.example === 'object'
            ? { problem: String(parsed.example.problem || '').trim(), solution: String(parsed.example.solution || '').trim() }
            : { problem: '', solution: '' },
          tips: Array.isArray(parsed.tips) ? parsed.tips : [],
          common_mistakes: Array.isArray(parsed.common_mistakes) ? parsed.common_mistakes : [],
          pace_level: safePace,
          pace_label: PACE_GUIDE[safePace].label,
        };

        const hasContent = notes.overview.length > 20
          || notes.key_concepts.length > 0
          || notes.formulas.length > 0
          || notes.example.problem
          || notes.tips.length > 0;
        if (!hasContent) {
          throw new Error('AI returned empty notes (no overview, concepts, or example)');
        }

        return notes;
      } catch (err) {
        lastError = err;
        console.warn(`TopicNotesAgent attempt ${attempt + 1} failed (pace=${safePace}):`, err.message);
      }
    }

    console.error('TopicNotesAgent all retries exhausted', lastError?.message);
    throw new Error('AI generated invalid notes format. Please try again.');
  }
}

module.exports = new TopicNotesAgent();
module.exports.PACE_GUIDE = PACE_GUIDE;
