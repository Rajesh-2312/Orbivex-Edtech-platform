const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
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
 * Get analytics for a specific course (teacher/admin only).
 */
router.get('/course/:id', authMiddleware, roleMiddleware('admin', 'teacher'), async (req, res) => {
  try {
    const { count: enrolledCount } = await supabaseAdmin
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', req.params.id);

    const { data: lessons } = await supabaseAdmin
      .from('lessons')
      .select('id, title')
      .eq('course_id', req.params.id);

    const lessonIds = (lessons || []).map((l) => l.id);

    let completionCount = 0;
    if (lessonIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('progress')
        .select('*', { count: 'exact', head: true })
        .in('lesson_id', lessonIds)
        .eq('completed', true);
      completionCount = count || 0;
    }

    return success(res, {
      enrolled_students: enrolledCount || 0,
      total_lessons: lessons?.length || 0,
      total_completions: completionCount,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/* ─────────────────────────────────────────────────────────────
   PLACEMENT ANALYTICS  (admin / tpo)
───────────────────────────────────────────────────────────── */

/**
 * GET /api/analytics/placement
 * Returns placement statistics for a college.
 * Query: ?college_id=&batch_year=&branch_id=
 */
router.get('/placement', authMiddleware, roleMiddleware('admin', 'tpo', 'teacher'), async (req, res) => {
  try {
    const { college_id, batch_year, branch_id } = req.query;

    // ── 1. All drives for this college
    let drivesQuery = supabaseAdmin
      .from('placement_drives')
      .select('id, company_name, job_role, drive_date, status, ctc_min, ctc_max, branch_id, branches(name)');
    if (college_id) drivesQuery = drivesQuery.eq('college_id', college_id);
    if (branch_id) drivesQuery = drivesQuery.eq('branch_id', branch_id);
    const { data: drives } = await drivesQuery;

    const driveIds = (drives || []).map(d => d.id);

    // ── 2. All offers for those drives
    let offersQuery = supabaseAdmin
      .from('drive_offers')
      .select(`
        id, ctc, offer_type, status, drive_id,
        student:profiles!student_id(id, display_name, branch_id, branches(name, code))
      `);
    if (driveIds.length > 0) offersQuery = offersQuery.in('drive_id', driveIds);
    const { data: offers } = driveIds.length > 0 ? await offersQuery : { data: [] };

    // ── 3. Total eligible students
    let eligibleQuery = supabaseAdmin
      .from('drive_eligible_students')
      .select('student_id', { count: 'exact', head: true });
    if (driveIds.length > 0) eligibleQuery = eligibleQuery.in('drive_id', driveIds);
    const { count: totalEligible } = driveIds.length > 0 ? await eligibleQuery : { count: 0 };

    // ── 4. Total students in college
    let studentsQuery = supabaseAdmin
      .from('profiles')
      .select('id, branch_id, branches(name, code)', { count: 'exact' })
      .eq('role', 'student');
    if (college_id) studentsQuery = studentsQuery.eq('college_id', college_id);
    const { data: allStudents, count: totalStudents } = await studentsQuery;

    // ── 5. Compute stats
    const placedStudentIds = new Set(
      (offers || []).filter(o => ['offered', 'accepted'].includes(o.status)).map(o => o.student?.id).filter(Boolean)
    );

    const ctcValues = (offers || [])
      .filter(o => o.ctc && ['offered', 'accepted'].includes(o.status))
      .map(o => parseFloat(o.ctc));

    const avgCtc = ctcValues.length
      ? Math.round((ctcValues.reduce((s, v) => s + v, 0) / ctcValues.length) * 100) / 100
      : 0;
    const maxCtc = ctcValues.length ? Math.max(...ctcValues) : 0;
    const minCtc = ctcValues.length ? Math.min(...ctcValues) : 0;

    // ── 6. Branch-wise breakdown
    const branchMap = {};
    for (const s of allStudents || []) {
      const bName = s.branches?.name || 'Unknown';
      if (!branchMap[bName]) branchMap[bName] = { total: 0, placed: 0, offers: 0 };
      branchMap[bName].total += 1;
      if (placedStudentIds.has(s.id)) branchMap[bName].placed += 1;
    }
    for (const o of offers || []) {
      if (!['offered', 'accepted'].includes(o.status)) continue;
      const bName = o.student?.branches?.name || 'Unknown';
      if (!branchMap[bName]) branchMap[bName] = { total: 0, placed: 0, offers: 0 };
      branchMap[bName].offers += 1;
    }
    const branchBreakdown = Object.entries(branchMap).map(([branch, stats]) => ({
      branch,
      total_students: stats.total,
      placed_students: stats.placed,
      placement_pct: stats.total > 0 ? Math.round((stats.placed / stats.total) * 100) : 0,
      total_offers: stats.offers,
    })).sort((a, b) => b.placed_students - a.placed_students);

    // Build a fast lookup map: drive_id → drive
    const driveById = new Map((drives || []).map(d => [d.id, d]));

    // ── 7. Top recruiting companies
    const companyMap = {};
    for (const o of offers || []) {
      if (!['offered', 'accepted'].includes(o.status)) continue;
      const co = driveById.get(o.drive_id)?.company_name || 'Unknown';
      companyMap[co] = (companyMap[co] || 0) + 1;
    }
    const topCompanies = Object.entries(companyMap)
      .map(([company, count]) => ({ company, offers: count }))
      .sort((a, b) => b.offers - a.offers)
      .slice(0, 10);

    // ── 8. Month-wise drive activity
    const monthMap = {};
    for (const d of drives || []) {
      const m = new Date(d.drive_date).toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!monthMap[m]) monthMap[m] = { drives: 0, offers: 0 };
      monthMap[m].drives += 1;
    }
    for (const o of offers || []) {
      if (!['offered', 'accepted'].includes(o.status)) continue;
      const drive = driveById.get(o.drive_id);
      if (!drive) continue;
      const m = new Date(drive.drive_date).toLocaleString('default', { month: 'short', year: '2-digit' });
      if (monthMap[m]) monthMap[m].offers += 1;
    }
    const timeline = Object.entries(monthMap).map(([month, stats]) => ({ month, ...stats }));

    return success(res, {
      summary: {
        total_students: totalStudents || 0,
        total_eligible: totalEligible || 0,
        placed_students: placedStudentIds.size,
        total_drives: (drives || []).length,
        total_offers: (offers || []).filter(o => ['offered', 'accepted'].includes(o.status)).length,
        placement_pct: totalStudents
          ? Math.round((placedStudentIds.size / totalStudents) * 100)
          : 0,
        avg_ctc: avgCtc,
        max_ctc: maxCtc,
        min_ctc: minCtc,
      },
      branch_breakdown: branchBreakdown,
      top_companies: topCompanies,
      timeline,
      drives: (drives || []).map(d => ({
        id: d.id,
        company: d.company_name,
        role: d.job_role,
        date: d.drive_date,
        status: d.status,
        branch: d.branches?.name || null,
      })),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * GET /api/analytics/placement/student/:studentId
 * Returns individual student's placement readiness score.
 */
router.get('/placement/student/:studentId', authMiddleware, async (req, res) => {
  try {
    const sid = req.params.studentId;
    // Students can only fetch their own; staff can fetch anyone
    if (req.user.role === 'student' && req.user.id !== sid) {
      return error(res, 'Access denied', 403);
    }

    const [
      { count: coursesEnrolled },
      { count: lessonsCompleted },
      { data: quizData },
      { data: testData },
      { data: companyProgress },
      { data: practiceData },
      { data: offerData },
    ] = await Promise.all([
      supabaseAdmin.from('enrollments').select('*', { count: 'exact', head: true }).eq('user_id', sid),
      supabaseAdmin.from('progress').select('*', { count: 'exact', head: true }).eq('user_id', sid).eq('completed', true),
      supabaseAdmin.from('quiz_responses').select('score').eq('user_id', sid),
      supabaseAdmin.from('test_submissions').select('obtained_marks, status').eq('student_id', sid).eq('status', 'evaluated'),
      supabaseAdmin.from('company_round_progress').select('status').eq('student_id', sid).eq('status', 'completed'),
      supabaseAdmin.from('practice_sessions').select('questions_answered, correct_answers').eq('student_id', sid),
      supabaseAdmin.from('drive_offers').select('ctc, status, drive_id').eq('student_id', sid),
    ]);

    const avgQuiz = quizData?.length
      ? Math.round(quizData.reduce((s, q) => s + (q.score || 0), 0) / quizData.length)
      : 0;

    const practiceAcc = practiceData?.length
      ? Math.round(
          practiceData.reduce((s, p) => {
            if (!p.questions_answered) return s;
            return s + ((p.correct_answers || 0) / p.questions_answered) * 100;
          }, 0) / practiceData.filter(p => p.questions_answered > 0).length || 0
        )
      : 0;

    // Readiness score (0-100) — weighted average across 5 dimensions
    const weights = { courses: 0.2, quiz: 0.25, test: 0.2, company: 0.2, practice: 0.15 };
    const courseScore = Math.min((coursesEnrolled || 0) * 10, 100);
    const testScore = testData?.length ? Math.min(testData.length * 20, 100) : 0;
    const companyScore = Math.min((companyProgress?.length || 0) * 15, 100);

    const readiness = Math.round(
      courseScore * weights.courses +
      avgQuiz * weights.quiz +
      testScore * weights.test +
      companyScore * weights.company +
      practiceAcc * weights.practice
    );

    return success(res, {
      student_id: sid,
      readiness_score: readiness,
      breakdown: {
        courses_enrolled: coursesEnrolled || 0,
        lessons_completed: lessonsCompleted || 0,
        avg_quiz_score: avgQuiz,
        quizzes_taken: quizData?.length || 0,
        tests_evaluated: testData?.length || 0,
        company_rounds_cleared: companyProgress?.length || 0,
        practice_accuracy: practiceAcc,
        practice_sessions: practiceData?.length || 0,
      },
      placement: {
        offers: offerData?.length || 0,
        accepted: (offerData || []).filter(o => o.status === 'accepted').length,
        highest_ctc: offerData?.length
          ? Math.max(...offerData.map(o => parseFloat(o.ctc || 0)))
          : 0,
      },
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

module.exports = router;

