const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { success, error } = require('../utils/response');

// Both read routes were unauthenticated: anyone who could guess a UUID could
// pull full `content_text` for any lesson on the platform, with no login and no
// course_access check. Requiring a session is the floor; per-enrollment gating
// lands in Phase 2 (see the `filterByCourseAccess` work in routes/courses.js).

/**
 * GET /api/courses/:courseId/lessons
 * List all lessons for a course.
 */
router.get('/course/:courseId', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('lessons')
    .select('*')
    .eq('course_id', req.params.courseId)
    .order('sort_order', { ascending: true });

  if (dbError) return error(res, dbError.message);
  return success(res, data);
});

/**
 * GET /api/lessons/:id
 * Get a single lesson detail.
 */
router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('lessons')
    .select('*, quizzes(id, title)')
    .eq('id', req.params.id)
    .single();

  if (dbError) return error(res, 'Lesson not found', 404);
  return success(res, data);
});

/**
 * POST /api/lessons
 * Create a new lesson (teacher/admin only).
 */
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res) => {
  const { course_id, title, description, video_url, content_text, sort_order, duration_minutes } = req.body;

  if (!course_id || !title) return error(res, 'course_id and title are required');

  const { data, error: dbError } = await supabaseAdmin
    .from('lessons')
    .insert({
      course_id,
      title,
      description,
      video_url,
      content_text,
      sort_order: sort_order || 0,
      duration_minutes,
    })
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data, 201);
});

/**
 * PUT /api/lessons/:id
 * Update a lesson (teacher/admin only).
 */
router.put('/:id', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res) => {
  const { title, description, video_url, content_text, sort_order, duration_minutes } = req.body;

  const { data, error: dbError } = await supabaseAdmin
    .from('lessons')
    .update({ title, description, video_url, content_text, sort_order, duration_minutes })
    .eq('id', req.params.id)
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data);
});

module.exports = router;
