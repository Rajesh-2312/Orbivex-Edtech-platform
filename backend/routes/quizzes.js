const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { success, error } = require('../utils/response');
const { notify } = require('../utils/notifications');

/**
 * GET /api/quizzes/lesson/:lessonId
 * Get quiz for a lesson.
 */
router.get('/lesson/:lessonId', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabase
    .from('quizzes')
    .select('*')
    .eq('lesson_id', req.params.lessonId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (dbError) return error(res, 'No quiz found for this lesson', 404);
  return success(res, data);
});

/**
 * POST /api/quizzes/submit
 * Submit quiz answers and get score.
 */
router.post('/submit', authMiddleware, async (req, res) => {
  const { quiz_id, answers } = req.body;

  if (!quiz_id || !answers) return error(res, 'quiz_id and answers are required');

  // Fetch the quiz
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quiz_id)
    .single();

  if (!quiz) return error(res, 'Quiz not found', 404);

  // Calculate score
  const questions = quiz.questions_json;
  let correct = 0;
  const results = questions.map((q, i) => {
    const userAnswer = answers[i];
    const isCorrect = userAnswer === q.correct_answer;
    if (isCorrect) correct++;
    return {
      question: q.question,
      user_answer: userAnswer,
      correct_answer: q.correct_answer,
      is_correct: isCorrect,
      explanation: q.explanation || null,
    };
  });

  const score = Math.round((correct / questions.length) * 100);

  // Save response
  const { data: response, error: dbError } = await supabase
    .from('quiz_responses')
    .insert({
      user_id: req.user.id,
      quiz_id,
      score,
      answers_json: results,
    })
    .select()
    .single();

  if (dbError) return error(res, dbError.message);

  // Notify the student of the score (toast + email). Fire-and-forget.
  notify({
    userId: req.user.id,
    type: 'grade',
    title: 'Quiz scored',
    message: `You scored ${score}% (${correct}/${questions.length}) on ${quiz.title || 'a quiz'}.`,
    entityType: 'quiz_response',
    entityId: response.id,
    actionUrl: quiz.lesson_id ? `/lessons/${quiz.lesson_id}` : null,
  }).catch(() => {});

  return success(res, {
    score,
    correct,
    total: questions.length,
    results,
    response_id: response.id,
  });
});

/**
 * GET /api/quizzes/results/:quizId
 * Get user's quiz results.
 */
router.get('/results/:quizId', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabase
    .from('quiz_responses')
    .select('*')
    .eq('quiz_id', req.params.quizId)
    .eq('user_id', req.user.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single();

  if (dbError) return error(res, 'No results found', 404);
  return success(res, data);
});

module.exports = router;
