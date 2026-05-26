const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const quizAgent = require('../agents/quizAgent');
const gradingAgent = require('../agents/gradingAgent');
const plagiarismAgent = require('../agents/plagiarismAgent');
const recommendAgent = require('../agents/recommendAgent');
const summaryAgent = require('../agents/summaryAgent');
const courseGeneratorAgent = require('../agents/courseGeneratorAgent');
const { success, error } = require('../utils/response');

/**
 * POST /api/ai/generate-quiz
 * Generate quiz questions from lesson content.
 */
router.post('/generate-quiz', authMiddleware, async (req, res) => {
  const { lesson_id, content, num_questions = 5 } = req.body;

  if (!content) return error(res, 'content is required');

  try {
    const questions = await quizAgent.generate(content, num_questions);

    // Optionally save to database
    if (lesson_id) {
      const { data: quiz } = await supabase
        .from('quizzes')
        .insert({
          lesson_id,
          title: `Auto-generated Quiz (${questions.length} questions)`,
          questions_json: questions,
        })
        .select()
        .single();

      return success(res, { quiz_id: quiz?.id, questions });
    }

    return success(res, { questions });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * POST /api/ai/grade-assignment
 * Grade an assignment with AI feedback.
 */
router.post('/grade-assignment', authMiddleware, async (req, res) => {
  const { assignment_text, rubric } = req.body;

  if (!assignment_text) return error(res, 'assignment_text is required');

  try {
    const result = await gradingAgent.grade(assignment_text, rubric);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * POST /api/ai/check-plagiarism
 * Check text for plagiarism.
 */
router.post('/check-plagiarism', authMiddleware, async (req, res) => {
  const { text } = req.body;

  if (!text) return error(res, 'text is required');

  try {
    const result = await plagiarismAgent.check(text);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * POST /api/ai/recommend-lessons
 * Get personalized lesson recommendations.
 */
router.post('/recommend-lessons', authMiddleware, async (req, res) => {
  try {
    // Get user's completed lessons
    const { data: progressData } = await supabase
      .from('progress')
      .select('lessons(title)')
      .eq('user_id', req.user.id)
      .eq('completed', true);

    const completedLessons = progressData?.map((p) => p.lessons?.title).filter(Boolean) || [];

    // Get available courses
    const { data: courses } = await supabase
      .from('courses')
      .select('title, description, difficulty')
      .eq('is_published', true);

    const result = await recommendAgent.recommend(completedLessons, courses || []);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * POST /api/ai/summarize
 * Summarize lesson content.
 */
router.post('/summarize', authMiddleware, async (req, res) => {
  const { content } = req.body;

  if (!content) return error(res, 'content is required');

  try {
    const result = await summaryAgent.summarize(content);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * POST /api/ai/generate-course
 * Generate a course outline (title + description + lessons) for a subject.
 * If `save: true`, persists the course + lessons using the caller as created_by.
 */
router.post('/generate-course', authMiddleware, async (req, res) => {
  const { subject, difficulty, num_lessons, audience, save } = req.body;

  if (!subject) return error(res, 'subject is required');

  try {
    const outline = await courseGeneratorAgent.generate(subject, {
      difficulty,
      numLessons: num_lessons,
      audience,
    });

    if (!save) return success(res, { outline });

    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .insert({
        title: outline.title,
        description: outline.description || '',
        category: outline.category || 'general',
        difficulty: outline.difficulty || difficulty || 'beginner',
        created_by: req.user.id,
        is_published: false,
      })
      .select()
      .single();

    if (courseErr) return error(res, courseErr.message, 500);

    const lessonRows = (outline.lessons || []).map((l, i) => ({
      course_id: course.id,
      title: l.title,
      description: l.description || '',
      content_text: l.content_text || '',
      sort_order: i + 1,
      duration_minutes: l.duration_minutes || 15,
    }));

    let lessons = [];
    if (lessonRows.length) {
      const { data, error: lessonErr } = await supabase
        .from('lessons')
        .insert(lessonRows)
        .select();
      if (lessonErr) return error(res, lessonErr.message, 500);
      lessons = data;
    }

    return success(res, { course, lessons, outline });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

module.exports = router;
