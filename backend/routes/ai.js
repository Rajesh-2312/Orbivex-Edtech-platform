const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const quizAgent = require('../agents/quizAgent');
const gradingAgent = require('../agents/gradingAgent');
const plagiarismAgent = require('../agents/plagiarismAgent');
const recommendAgent = require('../agents/recommendAgent');
const summaryAgent = require('../agents/summaryAgent');
const courseGeneratorAgent = require('../agents/courseGeneratorAgent');
const { success, error } = require('../utils/response');

// Every route here is `authMiddleware` only — students legitimately use AI
// Studio (quiz generator, summarizer, recommender). What students must NOT be
// able to do is *persist* through these endpoints: before this guard, any
// student could POST /generate-quiz with someone else's lesson_id to inject a
// quiz into their lesson, or POST /generate-course {save:true} to create rows
// in the public catalog. Generation stays open; writing is role-gated.
const canPersist = (user) => user.role === 'teacher' || user.role === 'admin';

// Prompt-size ceiling. These handlers forward the body straight to a paid LLM,
// so an unbounded `content` is a billing hole as much as a latency one. Express
// accepts a 10mb JSON body globally — that is far more than any lesson.
const MAX_CONTENT_CHARS = 40_000;

const tooLong = (res, field, value) =>
  value && value.length > MAX_CONTENT_CHARS
    ? error(res, `${field} exceeds the ${MAX_CONTENT_CHARS.toLocaleString()} character limit`, 413)
    : null;

/**
 * POST /api/ai/generate-quiz
 * Generate quiz questions from lesson content.
 * Persisting to a lesson requires teacher/admin.
 */
router.post('/generate-quiz', authMiddleware, async (req, res) => {
  const { lesson_id, content, num_questions = 5 } = req.body;

  if (!content) return error(res, 'content is required');
  if (tooLong(res, 'content', content)) return;

  const num = Math.min(Math.max(parseInt(num_questions, 10) || 5, 1), 25);

  if (lesson_id && !canPersist(req.user)) {
    return error(res, 'Only a teacher or admin can attach a generated quiz to a lesson', 403);
  }

  try {
    const questions = await quizAgent.generate(content, num);

    // Optionally save to database
    if (lesson_id) {
      const { data: quiz } = await supabaseAdmin
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
  if (tooLong(res, 'assignment_text', assignment_text)) return;

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
  if (tooLong(res, 'text', text)) return;

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
    const { data: progressData } = await supabaseAdmin
      .from('progress')
      .select('lessons(title)')
      .eq('user_id', req.user.id)
      .eq('completed', true);

    const completedLessons = progressData?.map((p) => p.lessons?.title).filter(Boolean) || [];

    // Get available courses
    const { data: courses } = await supabaseAdmin
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
  if (tooLong(res, 'content', content)) return;

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

  // The frontend already hides "save" behind a `canSave` role check
  // (AIStudioPage.jsx) — this is the server-side half that actually holds.
  if (save && !canPersist(req.user)) {
    return error(res, 'Only a teacher or admin can save a generated course', 403);
  }

  try {
    const outline = await courseGeneratorAgent.generate(subject, {
      difficulty,
      numLessons: num_lessons,
      audience,
    });

    if (!save) return success(res, { outline });

    const { data: course, error: courseErr } = await supabaseAdmin
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
      const { data, error: lessonErr } = await supabaseAdmin
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
