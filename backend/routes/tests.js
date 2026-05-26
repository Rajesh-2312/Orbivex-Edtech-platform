const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { success, error } = require('../utils/response');

router.use(authMiddleware);

// GET /api/tests — list tests available to this student
router.get('/', async (req, res) => {
  const userId = req.user.id;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('college_id, branch_id, section_id')
    .eq('id', userId)
    .single();

  if (!profile) return error(res, 'Profile not found', 404);

  let query = supabaseAdmin
    .from('test_papers')
    .select('*, colleges(name), branches(name), sections(section_name)')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (profile.college_id) {
    query = query.eq('college_id', profile.college_id);
  }

  const { data: tests, error: testError } = await query;
  if (testError) return error(res, testError.message);

  const filtered = (tests || []).filter(t => {
    if (t.branch_id && t.branch_id !== profile.branch_id) return false;
    if (t.section_id && t.section_id !== profile.section_id) return false;
    return true;
  });

  const testIds = filtered.map(t => t.id);
  let subMap = {};
  if (testIds.length > 0) {
    const { data: subs } = await supabaseAdmin
      .from('test_submissions')
      .select('test_paper_id, status, obtained_marks, total_marks')
      .eq('student_id', userId)
      .in('test_paper_id', testIds);
    (subs || []).forEach(s => { subMap[s.test_paper_id] = s; });
  }

  const result = filtered.map(t => ({ ...t, my_submission: subMap[t.id] || null }));
  return success(res, result);
});

// GET /api/tests/:id — get test paper with questions (correct answers hidden until submitted)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: test, error: testError } = await supabaseAdmin
    .from('test_papers')
    .select('*, colleges(name), branches(name)')
    .eq('id', id)
    .eq('is_published', true)
    .single();

  if (testError || !test) return error(res, 'Test not found', 404);

  const { data: tpqs, error: qError } = await supabaseAdmin
    .from('test_paper_questions')
    .select('*, question_bank(*)')
    .eq('test_paper_id', id)
    .order('sort_order', { ascending: true });

  if (qError) return error(res, qError.message);

  const { data: submission } = await supabaseAdmin
    .from('test_submissions')
    .select('*')
    .eq('test_paper_id', id)
    .eq('student_id', userId)
    .maybeSingle();

  const submitted = submission?.status === 'submitted' || submission?.status === 'evaluated';

  const questions = (tpqs || []).map(tpq => {
    const q = { ...tpq.question_bank };
    if (!submitted && q.question_type === 'mcq' && Array.isArray(q.answers_json)) {
      q.answers_json = q.answers_json.map(opt => ({ text: opt.text }));
    }
    return {
      tpq_id: tpq.id,
      question_id: tpq.question_id,
      marks: tpq.marks || 1,
      sort_order: tpq.sort_order,
      question_text: q.question_text,
      question_type: q.question_type,
      difficulty_level: q.difficulty_level,
      answers_json: q.answers_json,
    };
  });

  return success(res, { ...test, questions, submission: submission || null });
});

// POST /api/tests/:id/start — start a test
router.post('/:id/start', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: test } = await supabaseAdmin
    .from('test_papers')
    .select('id, duration_minutes, total_marks')
    .eq('id', id)
    .eq('is_published', true)
    .single();

  if (!test) return error(res, 'Test not found or not available', 404);

  const { data: existing } = await supabaseAdmin
    .from('test_submissions')
    .select('*')
    .eq('test_paper_id', id)
    .eq('student_id', userId)
    .maybeSingle();

  if (existing?.status === 'submitted' || existing?.status === 'evaluated') {
    return error(res, 'You have already submitted this test', 400);
  }

  if (existing?.status === 'in_progress') {
    return success(res, existing);
  }

  const { data: submission, error: createError } = await supabaseAdmin
    .from('test_submissions')
    .insert({
      test_paper_id: id,
      student_id: userId,
      started_at: new Date().toISOString(),
      status: 'in_progress',
      total_marks: test.total_marks || 0,
    })
    .select()
    .single();

  if (createError) return error(res, createError.message);
  return success(res, submission, 201);
});

// POST /api/tests/:id/submit — submit answers and auto-score MCQs
router.post('/:id/submit', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { responses } = req.body;

  if (!responses || typeof responses !== 'object') {
    return error(res, 'responses object is required');
  }

  const { data: submission } = await supabaseAdmin
    .from('test_submissions')
    .select('*')
    .eq('test_paper_id', id)
    .eq('student_id', userId)
    .maybeSingle();

  if (!submission) return error(res, 'You must start the test first', 400);
  if (submission.status === 'submitted' || submission.status === 'evaluated') {
    return error(res, 'Test already submitted', 400);
  }

  const { data: tpqs } = await supabaseAdmin
    .from('test_paper_questions')
    .select('*, question_bank(*)')
    .eq('test_paper_id', id);

  let obtained = 0;
  let total = 0;

  (tpqs || []).forEach(tpq => {
    const q = tpq.question_bank;
    const marks = tpq.marks || 1;
    total += marks;
    if (q.question_type === 'mcq' && responses[q.id] !== undefined && responses[q.id] !== null) {
      const correctIdx = (q.answers_json || []).findIndex(a => a.correct === true);
      if (correctIdx !== -1 && parseInt(responses[q.id]) === correctIdx) {
        obtained += marks;
      }
    }
  });

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('test_submissions')
    .update({
      response_json: responses,
      submitted_at: new Date().toISOString(),
      obtained_marks: obtained,
      total_marks: total,
      status: 'submitted',
    })
    .eq('id', submission.id)
    .select()
    .single();

  if (updateError) return error(res, updateError.message);

  return success(res, {
    ...updated,
    percentage: total > 0 ? Math.round((obtained / total) * 100) : 0,
  });
});

// GET /api/tests/:id/my-result — full result with question review
router.get('/:id/my-result', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: submission } = await supabaseAdmin
    .from('test_submissions')
    .select('*')
    .eq('test_paper_id', id)
    .eq('student_id', userId)
    .maybeSingle();

  if (!submission || submission.status === 'in_progress') {
    return error(res, 'No result available yet', 404);
  }

  const { data: test } = await supabaseAdmin
    .from('test_papers')
    .select('title, total_marks, passing_score, duration_minutes, test_type, company_name')
    .eq('id', id)
    .single();

  const { data: tpqs } = await supabaseAdmin
    .from('test_paper_questions')
    .select('*, question_bank(*)')
    .eq('test_paper_id', id)
    .order('sort_order', { ascending: true });

  const responses = submission.response_json || {};
  const questions = (tpqs || []).map(tpq => {
    const q = tpq.question_bank;
    const studentAnswer = responses[q.id];
    let isCorrect = null;
    if (q.question_type === 'mcq') {
      const correctIdx = (q.answers_json || []).findIndex(a => a.correct === true);
      isCorrect = studentAnswer !== undefined && studentAnswer !== null
        ? parseInt(studentAnswer) === correctIdx
        : false;
    }
    return {
      question_id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      difficulty_level: q.difficulty_level,
      marks: tpq.marks || 1,
      answers_json: q.answers_json,
      student_answer: studentAnswer !== undefined ? studentAnswer : null,
      is_correct: isCorrect,
    };
  });

  const percentage = submission.total_marks > 0
    ? Math.round((submission.obtained_marks / submission.total_marks) * 100)
    : 0;

  return success(res, {
    submission,
    test,
    questions,
    percentage,
    passed: test?.passing_score ? percentage >= test.passing_score : null,
  });
});

module.exports = router;
