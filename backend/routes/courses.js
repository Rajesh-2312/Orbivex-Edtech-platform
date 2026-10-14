const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { success, error, paginated } = require('../utils/response');

/**
 * GET /api/courses
 * List all published courses.
 */
router.get('/', authMiddleware, async (req, res) => {
  const { page = 1, limit = 20, category, difficulty, search } = req.query;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('courses')
    .select('*', { count: 'exact' })
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error: dbError, count } = await query;
  if (dbError) return error(res, dbError.message);

  const filtered = await filterByCourseAccess(data || [], req.user);
  return paginated(res, filtered, filtered.length, parseInt(page), parseInt(limit));
});

/**
 * Apply course_access gating.
 *  - admin / teacher: see everything
 *  - student: for each course, if any course_access rows exist, the student's
 *    profile (college/branch/section) must match one of them. NULL = wildcard.
 *  - courses with zero access rows are public.
 */
async function filterByCourseAccess(courses, user) {
  if (!user || user.role === 'admin' || user.role === 'teacher') return courses;
  if (courses.length === 0) return courses;

  const courseIds = courses.map((c) => c.id);
  const { data: accessRows } = await supabaseAdmin
    .from('course_access')
    .select('course_id, college_id, branch_id, section_id')
    .in('course_id', courseIds);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('college_id, branch_id, section_id')
    .eq('id', user.id)
    .single();

  const byCourse = {};
  (accessRows || []).forEach((r) => {
    (byCourse[r.course_id] = byCourse[r.course_id] || []).push(r);
  });

  const matches = (row) =>
    (!row.college_id || row.college_id === profile?.college_id) &&
    (!row.branch_id || row.branch_id === profile?.branch_id) &&
    (!row.section_id || row.section_id === profile?.section_id);

  return courses.filter((c) => {
    const rows = byCourse[c.id];
    if (!rows || rows.length === 0) return true;
    return rows.some(matches);
  });
}

/**
 * GET /api/courses/:id
 * Get a single course with its lessons.
 *
 * Was unauthenticated and had no `is_published` filter, so unpublished drafts
 * and access-restricted courses were readable by anyone with the id — walking
 * straight around `filterByCourseAccess`. Now: session required, drafts limited
 * to staff, and the same access gate the list endpoint uses.
 */
router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('courses')
    .select('*, lessons(id, title, description, sort_order, duration_minutes)')
    .eq('id', req.params.id)
    .single();

  if (dbError) return error(res, 'Course not found', 404);

  const isStaff = req.user.role === 'admin' || req.user.role === 'teacher';
  if (!data.is_published && !isStaff) return error(res, 'Course not found', 404);

  const [visible] = await filterByCourseAccess([data], req.user);
  if (!visible) return error(res, 'You do not have access to this course', 403);

  return success(res, data);
});

/**
 * POST /api/courses
 * Create a new course (teacher/admin only).
 */
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res) => {
  const { title, description, category, difficulty, thumbnail_url } = req.body;

  if (!title) return error(res, 'Title is required');

  const { data, error: dbError } = await supabaseAdmin
    .from('courses')
    .insert({
      title,
      description,
      category,
      difficulty: difficulty || 'beginner',
      thumbnail_url,
      created_by: req.user.id,
    })
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data, 201);
});

/**
 * PUT /api/courses/:id
 * Update a course (owner only).
 */
router.put('/:id', authMiddleware, async (req, res) => {
  const { title, description, category, difficulty, thumbnail_url, is_published } = req.body;

  const { data, error: dbError } = await supabaseAdmin
    .from('courses')
    .update({
      title,
      description,
      category,
      difficulty,
      thumbnail_url,
      is_published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .eq('created_by', req.user.id)
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data);
});

/**
 * DELETE /api/courses/:id
 * Delete a course (owner only).
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  const { error: dbError } = await supabaseAdmin
    .from('courses')
    .delete()
    .eq('id', req.params.id)
    .eq('created_by', req.user.id);

  if (dbError) return error(res, dbError.message);
  return success(res, { message: 'Course deleted' });
});

/**
 * POST /api/enroll
 * Enroll current user in a course.
 */
router.post('/enroll', authMiddleware, async (req, res) => {
  const { course_id } = req.body;
  if (!course_id) return error(res, 'course_id is required');

  // `course_access` was enforced on listing only, so a student could enroll in
  // any course — including another college's, and including unpublished drafts
  // — by posting the id directly. Gate the write with the same rule as the read.
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('id, is_published')
    .eq('id', course_id)
    .single();

  if (!course) return error(res, 'Course not found', 404);
  if (!course.is_published) return error(res, 'This course is not open for enrollment', 403);

  const [allowed] = await filterByCourseAccess([course], req.user);
  if (!allowed) return error(res, 'You do not have access to this course', 403);

  const { data, error: dbError } = await supabaseAdmin
    .from('enrollments')
    .insert({ user_id: req.user.id, course_id })
    .select()
    .single();

  if (dbError) {
    if (dbError.code === '23505') return error(res, 'Already enrolled in this course');
    return error(res, dbError.message);
  }
  return success(res, data, 201);
});

/**
 * GET /api/courses/my/enrolled
 * Get courses the current user is enrolled in.
 */
router.get('/my/enrolled', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('enrollments')
    .select('enrolled_at, courses(*)')
    .eq('user_id', req.user.id)
    .order('enrolled_at', { ascending: false });

  if (dbError) return error(res, dbError.message);
  return success(res, data);
});

module.exports = router;
