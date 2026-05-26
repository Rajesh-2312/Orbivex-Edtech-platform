const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { tutorLimiter } = require('../middleware/rateLimiter');
const { supabaseAdmin } = require('../config/supabase');
const { success, error } = require('../utils/response');
const tutorAgent = require('../agents/tutorAgent');

/**
 * GET /api/tutor/lessons/:id/history
 * Returns this user's tutor messages on a given lesson (ascending by time).
 */
router.get('/lessons/:id/history', authMiddleware, async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('tutor_messages')
    .select('id, role, content, citations, created_at')
    .eq('user_id', req.user.id)
    .eq('lesson_id', req.params.id)
    .order('created_at', { ascending: true })
    .limit(50);
  if (dbErr) return error(res, dbErr.message, 500);
  return success(res, data || []);
});

/**
 * POST /api/tutor/lessons/:id/chat
 * Body: { message, history? }
 * Returns: { answer, citations, user_message_id, assistant_message_id }
 */
router.post('/lessons/:id/chat', authMiddleware, tutorLimiter, async (req, res) => {
  const lessonId = req.params.id;
  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return error(res, 'message is required');
  }
  if (message.length > 2000) return error(res, 'message too long (max 2000 chars)');

  try {
    // Persist user turn first so it's visible even if the model call fails.
    const { data: userRow } = await supabaseAdmin
      .from('tutor_messages')
      .insert({
        user_id: req.user.id,
        lesson_id: lessonId,
        role: 'user',
        content: message.trim(),
      })
      .select('id')
      .single();

    // If client didn't provide history, hydrate from DB (last 12 turns).
    let useHistory = Array.isArray(history) ? history : null;
    if (!useHistory) {
      const { data: rows } = await supabaseAdmin
        .from('tutor_messages')
        .select('role, content')
        .eq('user_id', req.user.id)
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: false })
        .limit(12);
      useHistory = (rows || []).reverse().slice(0, -1); // drop the row we just inserted
    }

    const { answer: text, citations } = await tutorAgent.answer({
      lessonId,
      userId: req.user.id,
      message: message.trim(),
      history: useHistory,
    });

    const { data: asstRow } = await supabaseAdmin
      .from('tutor_messages')
      .insert({
        user_id: req.user.id,
        lesson_id: lessonId,
        role: 'assistant',
        content: text,
        citations,
      })
      .select('id')
      .single();

    return success(res, {
      answer: text,
      citations,
      user_message_id: userRow?.id || null,
      assistant_message_id: asstRow?.id || null,
    });
  } catch (err) {
    console.error('[tutor] failed:', err?.message || err);
    return error(res, err?.message || 'Tutor failed', 500);
  }
});

module.exports = router;
