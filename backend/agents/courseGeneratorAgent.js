/**
 * CourseGeneratorAgent v2 — Expert-grade full course generation
 * Generates course title, description, lessons, and rich content
 * Indian engineering curriculum-aware
 */
const AgentBase = require('./agentBase');

const INDIAN_ENGINEERING_CONTEXT = `Context: Indian engineering college (B.Tech/B.E.), autonomous university system, JNTU/VTU/Anna University syllabus pattern. Students are in semesters 1-8. Include relevant Indian industry examples (TCS, Infosys, Wipro, Indian startups). Assessment style: theory + numerical problems.`;

const DIFFICULTY_LEVELS = {
  beginner: 'First or second year undergraduate, introductory concepts',
  intermediate: 'Third year undergraduate, applied concepts with coding/design',
  advanced: 'Fourth year or postgraduate, industry-level depth with case studies',
};

class CourseGeneratorAgent extends AgentBase {
  constructor() {
    super('CourseGeneratorAgent', {
      primaryModel: 'claude',
      maxRetries: 2,
      baseTimeoutMs: 180_000,
      temperature: 0.45,
    });
    this.baseMaxTokens = 2500;
  }

  buildPrompt(subject, options = {}) {
    const {
      difficulty = 'intermediate',
      numLessons = 5,
      audience = 'B.Tech students',
      includeObjectives = true,
    } = options;

    const difficultyDesc = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.intermediate;

    return `You are a senior curriculum designer for Indian engineering colleges.

${INDIAN_ENGINEERING_CONTEXT}

Create a complete course on: "${subject}"
Difficulty: ${difficulty} (${difficultyDesc})
Target: ${audience}
Lessons: exactly ${numLessons}

Each lesson must have:
- A clear, specific title
- A 2-sentence description
- 150-200 word content_text (introduction, key concepts, example)
- duration_minutes (15-45 based on depth)

Return ONLY valid JSON:
{
  "title": "Specific course title",
  "description": "2-sentence course description for college catalog",
  "category": "technical|soft-skills|placement|language",
  "difficulty": "${difficulty}",
  "estimated_hours": <number>,
  "learning_objectives": ["Students will...", "Students will..."],
  "lessons": [
    {
      "title": "Lesson title",
      "description": "2-sentence description",
      "content_text": "150-200 word lesson body with concepts and examples",
      "duration_minutes": 30
    }
  ]
}`;
  }

  validateResponse(parsed) {
    if (!parsed.title) throw new Error('Missing course title');
    if (!Array.isArray(parsed.lessons) || parsed.lessons.length === 0) throw new Error('Missing lessons array');
    for (const lesson of parsed.lessons) {
      if (!lesson.title) throw new Error('Lesson missing title');
      if (!lesson.content_text) throw new Error('Lesson missing content_text');
    }
    return true;
  }

  postProcess(parsed) {
    // Ensure all fields have sensible defaults
    return {
      title: parsed.title.trim(),
      description: parsed.description || `A comprehensive course on ${parsed.title}.`,
      category: parsed.category || 'technical',
      difficulty: parsed.difficulty || 'intermediate',
      estimated_hours: parsed.estimated_hours || Math.ceil(parsed.lessons.length * 0.5),
      learning_objectives: parsed.learning_objectives || [],
      lessons: parsed.lessons.map((l, i) => ({
        title: l.title?.trim() || `Lesson ${i + 1}`,
        description: l.description || '',
        content_text: l.content_text || '',
        duration_minutes: Number(l.duration_minutes) || 30,
        sort_order: i + 1,
      })),
    };
  }

  async generate(subject, options = {}) {
    if (!subject?.trim()) throw new Error('Subject is required');

    const numLessons = Math.min(Math.max(options.numLessons || 5, 2), 8);
    const timeoutMs = Math.max(120_000, numLessons * 25_000);
    const maxTokens = Math.max(2000, numLessons * 400);

    return super.generate([subject, { ...options, numLessons }], { maxTokens, timeoutMs });
  }
}

module.exports = new CourseGeneratorAgent();
