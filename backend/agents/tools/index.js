/**
 * Orbivex assistant tool registry.
 *
 * Each tool is a whitelisted capability the assistant may invoke. There is no
 * generic "call any endpoint" or "run SQL" tool — the model can only reach what
 * is declared here, and every handler re-scopes its data access to the calling
 * user (`user.id`), so asking nicely never crosses a tenant boundary.
 *
 * A tool declares:
 *   name        — stable id the router emits
 *   description — what it does (shown to the router)
 *   parameters  — JSON-schema-ish arg spec, for the router and for validation
 *   readOnly    — false ⇒ the route must get explicit user confirmation before
 *                 the handler runs (writes are never silent)
 *   roles       — which roles may call it (default: any authenticated user)
 *   handler     — async (user, args) ⇒ structured result (the ground truth the
 *                 model narrates; it must never recompute these facts)
 */

const { supabaseAdmin } = require('../../config/supabase');
const { retrieveContext } = require('../../utils/rag');

// ── read-only tools ──────────────────────────────────────────────────────────

const getMyProgress = {
  name: 'get_my_progress',
  description: "Get the student's overall learning progress: enrolled courses, completed lessons, quizzes taken, and average quiz score. Use for 'how am I doing', 'my progress', 'my stats'.",
  parameters: { type: 'object', properties: {}, required: [] },
  readOnly: true,
  async handler(user) {
    const [{ data: enrollments }, { count: completed }, { data: quizzes }] = await Promise.all([
      supabaseAdmin.from('enrollments').select('course_id').eq('user_id', user.id),
      supabaseAdmin.from('progress').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('completed', true),
      supabaseAdmin.from('quiz_responses').select('score').eq('user_id', user.id),
    ]);
    const avg = quizzes?.length ? Math.round(quizzes.reduce((s, q) => s + (q.score || 0), 0) / quizzes.length) : 0;
    return {
      enrolled_courses: enrollments?.length || 0,
      completed_lessons: completed || 0,
      quizzes_taken: quizzes?.length || 0,
      average_score: avg,
    };
  },
};

const searchLessons = {
  name: 'search_lessons',
  description: "Semantically search the student's lesson content for a topic or concept. Use to find where something is taught or to answer a factual question grounded in course material. Returns matching passages with their lesson titles.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for' },
      course_id: { type: 'string', description: 'Optional: restrict to one course' },
    },
    required: ['query'],
  },
  readOnly: true,
  async handler(user, { query, course_id }) {
    const chunks = await retrieveContext(query, {
      source_type: 'lesson',
      course_id: course_id || null,
      match_count: 5,
    });
    return {
      matches: chunks.map((c) => ({
        lesson_title: c.metadata?.lesson_title || null,
        heading_path: c.metadata?.heading_path || [],
        excerpt: String(c.content_chunk || '').slice(0, 300),
        similarity: typeof c.similarity === 'number' ? Number(c.similarity.toFixed(3)) : null,
      })),
      count: chunks.length,
    };
  },
};

const getSkillGap = {
  name: 'get_skill_gap',
  description: "Get the student's most recent skill-gap analysis: their score, weak topics, strong topics, and study plan. Use for 'what are my weak areas', 'what should I study'.",
  parameters: { type: 'object', properties: {}, required: [] },
  readOnly: true,
  async handler(user) {
    const { data } = await supabaseAdmin
      .from('skill_gap_results')
      .select('score, weak_topics, strong_topics, study_plan, updated_at')
      .eq('student_id', user.id)
      .maybeSingle();
    if (!data) return { has_result: false, message: 'No skill-gap analysis has been run yet.' };
    return { has_result: true, ...data };
  },
};

const getCodingProblems = {
  name: 'get_coding_problems',
  description: "List DSA / coding practice problems, optionally filtered by topic or difficulty, with the student's solve status. Use for 'give me practice problems', 'coding questions on arrays'.",
  parameters: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'e.g. Arrays, Strings, Trees' },
      difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    },
    required: [],
  },
  readOnly: true,
  async handler(user, { topic, difficulty }) {
    let q = supabaseAdmin
      .from('coding_problems')
      .select('slug, title, topic, difficulty, companies')
      .eq('is_active', true)
      .order('difficulty')
      .limit(10);
    if (topic) q = q.eq('topic', topic);
    if (difficulty) q = q.eq('difficulty', difficulty);

    const { data: problems } = await q;
    return {
      problems: (problems || []).map((p) => ({
        slug: p.slug, title: p.title, topic: p.topic, difficulty: p.difficulty,
        companies: p.companies || [],
      })),
      count: (problems || []).length,
      filtered_by: { topic: topic || null, difficulty: difficulty || null },
    };
  },
};

const listMyCourses = {
  name: 'list_my_courses',
  description: "List the courses the student is enrolled in, with per-course completion percentage. Use for 'what am I enrolled in', 'my courses'.",
  parameters: { type: 'object', properties: {}, required: [] },
  readOnly: true,
  async handler(user) {
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('course_id, courses(title)')
      .eq('user_id', user.id);
    if (!enrollments?.length) return { courses: [], count: 0 };

    // Batched, not N+1: one query for all lessons across the enrolled courses,
    // one for all completed progress. Percentages are then computed in memory.
    const courseIds = enrollments.map((e) => e.course_id);
    const { data: lessons } = await supabaseAdmin
      .from('lessons').select('id, course_id').in('course_id', courseIds);
    const lessonIds = (lessons || []).map((l) => l.id);

    const { data: completed } = lessonIds.length
      ? await supabaseAdmin
          .from('progress').select('lesson_id')
          .eq('user_id', user.id).eq('completed', true).in('lesson_id', lessonIds)
      : { data: [] };

    const lessonToCourse = new Map((lessons || []).map((l) => [l.id, l.course_id]));
    const totalByCourse = {};
    (lessons || []).forEach((l) => { totalByCourse[l.course_id] = (totalByCourse[l.course_id] || 0) + 1; });
    const doneByCourse = {};
    (completed || []).forEach((p) => {
      const cid = lessonToCourse.get(p.lesson_id);
      if (cid) doneByCourse[cid] = (doneByCourse[cid] || 0) + 1;
    });

    const out = enrollments.map((e) => {
      const total = totalByCourse[e.course_id] || 0;
      const done = doneByCourse[e.course_id] || 0;
      return {
        course_id: e.course_id,
        title: e.courses?.title || 'Untitled',
        completion_percent: total ? Math.round((done / total) * 100) : 0,
      };
    });
    return { courses: out, count: out.length };
  },
};

// ── write tool (requires confirmation) ──────────────────────────────────────

/**
 * Resolve a course reference that may be a UUID or a natural-language name
 * ("the python course") to a real published course row. The router cannot know
 * UUIDs, so name resolution is what makes name-based enrolment work.
 */
async function resolveCourse(ref) {
  if (!ref) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
  if (isUuid) {
    const { data } = await supabaseAdmin.from('courses').select('id, title').eq('id', ref).maybeSingle();
    return data;
  }
  const { data } = await supabaseAdmin
    .from('courses').select('id, title').ilike('title', `%${ref}%`).eq('is_published', true).limit(2);
  // Only accept an unambiguous match — never guess between two courses.
  return data && data.length === 1 ? data[0] : null;
}

const enrollInCourse = {
  name: 'enroll_in_course',
  description: "Enroll the student in a course. Pass the course name or id as `course`. This is a WRITE action and must be confirmed by the student before it runs.",
  parameters: {
    type: 'object',
    properties: { course: { type: 'string', description: 'Course name or id, e.g. "Python Programming"' } },
    required: ['course'],
  },
  readOnly: false,
  // Resolve the reference up front so the confirmation prompt can name the real
  // course, and so an ambiguous/unknown name is rejected before any write.
  async preview(user, { course }) {
    const resolved = await resolveCourse(course);
    if (!resolved) return { ok: false, error: `I couldn't find a single course matching "${course}".` };
    return { ok: true, summary: `Enroll you in "${resolved.title}"?`, resolved };
  },
  async handler(user, { course }) {
    const resolved = await resolveCourse(course);
    if (!resolved) throw new Error(`No single course matches "${course}".`);
    const { error: insErr } = await supabaseAdmin
      .from('enrollments')
      .upsert({ user_id: user.id, course_id: resolved.id }, { onConflict: 'user_id,course_id' });
    if (insErr) throw insErr;
    return { enrolled: true, course_id: resolved.id, title: resolved.title };
  },
};

// ── registry ─────────────────────────────────────────────────────────────────

const TOOLS = [
  getMyProgress,
  listMyCourses,
  searchLessons,
  getSkillGap,
  getCodingProblems,
  enrollInCourse,
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Tools this user's role is allowed to call, as router-facing specs. */
function toolSpecsFor(user) {
  return TOOLS
    .filter((t) => !t.roles || t.roles.includes(user.role))
    .map((t) => ({ name: t.name, description: t.description, parameters: t.parameters, readOnly: t.readOnly }));
}

/**
 * Run a tool by name for a user. Enforces existence, role, and (for writes) a
 * prior confirmation — the handler never runs on an unconfirmed write.
 * @returns {Promise<{name, ok, result?, error?, readOnly, ms}>}
 */
async function runTool(name, args, user, { confirmed = false } = {}) {
  const started = Date.now();
  const tool = BY_NAME.get(name);
  if (!tool) return { name, ok: false, error: `unknown tool: ${name}`, ms: 0 };
  if (tool.roles && !tool.roles.includes(user.role)) {
    return { name, ok: false, error: 'not permitted for your role', readOnly: tool.readOnly, ms: 0 };
  }
  if (!tool.readOnly && !confirmed) {
    // Resolve a human-readable summary (and reject bad args) before asking the
    // student to confirm, so the prompt says "Enroll you in Python Programming?"
    // rather than echoing a raw id — and an unresolvable request fails now.
    let summary = null;
    if (typeof tool.preview === 'function') {
      const p = await tool.preview(user, args || {});
      if (!p.ok) return { name, ok: false, error: p.error, readOnly: false, ms: Date.now() - started };
      summary = p.summary;
    }
    return { name, ok: false, needs_confirmation: true, summary, readOnly: false, args, ms: Date.now() - started };
  }
  try {
    const result = await tool.handler(user, args || {});
    return { name, ok: true, result, readOnly: tool.readOnly, ms: Date.now() - started };
  } catch (err) {
    return { name, ok: false, error: err.message, readOnly: tool.readOnly, ms: Date.now() - started };
  }
}

module.exports = { TOOLS, BY_NAME, toolSpecsFor, runTool };
