const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { success, error } = require('../utils/response');

/**
 * GET /api/courses/:courseId/lessons
 * List all lessons for a course.
 */
router.get('/course/:courseId', async (req, res) => {
  const { data, error: dbError } = await supabase
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
router.get('/:id', async (req, res) => {
  const { data, error: dbError } = await supabase
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

  const { data, error: dbError } = await supabase
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

  const { data, error: dbError } = await supabase
    .from('lessons')
    .update({ title, description, video_url, content_text, sort_order, duration_minutes })
    .eq('id', req.params.id)
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data);
});

module.exports = router;
