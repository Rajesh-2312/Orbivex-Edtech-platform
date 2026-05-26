const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { success, error } = require('../utils/response');

/**
 * GET /api/analytics/dashboard
 * Get dashboard stats for the current user.
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    // Enrolled courses count
    const { count: enrolledCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    // Completed lessons count
    const { count: completedCount } = await supabase
      .from('progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('completed', true);

    // Quiz average score
    const { data: quizData } = await supabase
      .from('quiz_responses')
      .select('score')
      .eq('user_id', req.user.id);

    const avgScore = quizData?.length
      ? Math.round(quizData.reduce((sum, q) => sum + q.score, 0) / quizData.length)
      : 0;

    // Recent activity (last 10 completions)
    const { data: recentActivity } = await supabase
      .from('progress')
      .select('completed_at, lessons(title, course_id, courses(title))')
      .eq('user_id', req.user.id)
      .eq('completed', true)
      .order('completed_at', { ascending: false })
      .limit(10);

    // Streak: consecutive days with at least one completion
    const { data: streakData } = await supabase
      .from('progress')
      .select('completed_at')
      .eq('user_id', req.user.id)
      .eq('completed', true)
      .order('completed_at', { ascending: false });

    let streak = 0;
    if (streakData?.length) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const days = new Set(
        streakData.map((p) => {
          const d = new Date(p.completed_at);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
      );
      const sortedDays = [...days].sort((a, b) => b - a);
      for (let i = 0; i < sortedDays.length; i++) {
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        expected.setHours(0, 0, 0, 0);
        if (sortedDays[i] === expected.getTime()) {
          streak++;
        } else {
          break;
        }
      }
    }

    return success(res, {
      enrolled_courses: enrolledCount || 0,
      completed_lessons: completedCount || 0,
      average_score: avgScore,
      quizzes_taken: quizData?.length || 0,
      current_streak: streak,
      recent_activity: recentActivity || [],
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * GET /api/analytics/course/:id
 * Get analytics for a specific course (teacher view).
 */
router.get('/course/:id', authMiddleware, async (req, res) => {
  const { count: enrolledCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', req.params.id);

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title')
    .eq('course_id', req.params.id);

  const lessonIds = lessons?.map((l) => l.id) || [];

  const { count: completionCount } = await supabase
    .from('progress')
    .select('*', { count: 'exact', head: true })
    .in('lesson_id', lessonIds)
    .eq('completed', true);

  return success(res, {
    enrolled_students: enrolledCount || 0,
    total_lessons: lessons?.length || 0,
    total_completions: completionCount || 0,
  });
});

module.exports = router;
