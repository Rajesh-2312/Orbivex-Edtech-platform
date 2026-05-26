const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { notify } = require('../utils/notifications');

/**
 * POST /api/progress
 * Mark a lesson as completed.
 */
router.post('/', authMiddleware, async (req, res) => {
  const { lesson_id } = req.body;
  if (!lesson_id) return error(res, 'lesson_id is required');

  const { data, error: dbError } = await supabase
    .from('progress')
    .upsert({
      user_id: req.user.id,
      lesson_id,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lesson_id' })
    .select()
    .single();

  if (dbError) return error(res, dbError.message);

  // Course-complete detection: find which course this lesson belongs to,
  // count completed vs total. Only notify when this completion was the
  // one that crossed the line (avoid duplicate notifications on idempotent
  // re-marks). Fire-and-forget.
  (async () => {
    try {
      const { data: lesson } = await supabaseAdmin
        .from('lessons')
        .select('course_id')
        .eq('id', lesson_id)
        .single();
      if (!lesson?.course_id) return;

      const { data: lessons } = await supabaseAdmin
        .from('lessons')
        .select('id')
        .eq('course_id', lesson.course_id);
      const total = lessons?.length || 0;
      if (total === 0) return;

      const lessonIds = lessons.map((l) => l.id);
      const { count: completed } = await supabaseAdmin
        .from('progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('completed', true)
        .in('lesson_id', lessonIds);

      if (completed === total) {
        const { data: course } = await supabaseAdmin
          .from('courses')
          .select('title')
          .eq('id', lesson.course_id)
          .single();

        // De-duplicate: only insert the celebratory notification if there
        // isn't already one for this user+course.
        const { count: alreadyNotified } = await supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', req.user.id)
          .eq('type', 'course_complete')
          .eq('entity_id', lesson.course_id);

        if (!alreadyNotified) {
          await notify({
            userId: req.user.id,
            type: 'course_complete',
            title: 'Course complete',
            message: `You finished ${course?.title || 'a course'}. Great job!`,
            entityType: 'course',
            entityId: lesson.course_id,
            actionUrl: '/progress',
          });
        }
      }
    } catch (err) {
      console.warn('[progress] complete-check failed:', err?.message);
    }
  })();

  return success(res, data);
});

/**
 * GET /api/progress/course/:courseId
 * Get progress for all lessons in a course.
 */
router.get('/course/:courseId', authMiddleware, async (req, res) => {
  // Get all lessons for this course
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, sort_order')
    .eq('course_id', req.params.courseId)
    .order('sort_order');

  // Get user's progress for these lessons
  const lessonIds = lessons?.map((l) => l.id) || [];
  const { data: progressData } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', req.user.id)
    .in('lesson_id', lessonIds);

  const progressMap = {};
  progressData?.forEach((p) => {
    progressMap[p.lesson_id] = p;
  });

  const result = lessons?.map((lesson) => ({
    ...lesson,
    completed: progressMap[lesson.id]?.completed || false,
    completed_at: progressMap[lesson.id]?.completed_at || null,
  }));

  const completedCount = result?.filter((l) => l.completed).length || 0;
  const totalCount = result?.length || 0;

  return success(res, {
    lessons: result,
    completed: completedCount,
    total: totalCount,
    percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
  });
});

/**
 * GET /api/progress/summary
 * Overall progress summary for the user.
 */
router.get('/summary', authMiddleware, async (req, res) => {
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('user_id', req.user.id);

  const { data: allProgress, count } = await supabase
    .from('progress')
    .select('*', { count: 'exact' })
    .eq('user_id', req.user.id)
    .eq('completed', true);

  const { data: quizResults } = await supabase
    .from('quiz_responses')
    .select('score')
    .eq('user_id', req.user.id);

  const avgScore = quizResults?.length
    ? Math.round(quizResults.reduce((sum, q) => sum + q.score, 0) / quizResults.length)
    : 0;

  return success(res, {
    enrolled_courses: enrollments?.length || 0,
    completed_lessons: count || 0,
    quizzes_taken: quizResults?.length || 0,
    average_score: avgScore,
  });
});

module.exports = router;
