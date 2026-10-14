const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { tutorLimiter } = require('../middleware/rateLimiter');
const { supabaseAdmin } = require('../config/supabase');
const { success, error } = require('../utils/response');
const tutorAgent = require('../agents/tutorAgent');
const { scoreAndPersistGroundedness } = require('../agents/verifier');

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

/**
 * POST /api/tutor/lessons/:id/chat/stream
 * Same contract as /chat but streams the answer as Server-Sent Events:
 *
 *   event: citations  data: { citations }
 *   event: token      data: { value }
 *   event: done       data: { answer, citations, user_message_id, assistant_message_id }
 *   event: error      data: { error }
 *
 * The user turn is persisted before streaming (so it survives a mid-stream
 * failure); the assistant turn is persisted on 'done'.
 */
router.post('/lessons/:id/chat/stream', authMiddleware, tutorLimiter, async (req, res) => {
  const lessonId = req.params.id;
  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return error(res, 'message is required');
  }
  if (message.length > 2000) return error(res, 'message too long (max 2000 chars)');

  // SSE headers. Disable proxy buffering so tokens are not held back.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const { data: userRow } = await supabaseAdmin
      .from('tutor_messages')
      .insert({ user_id: req.user.id, lesson_id: lessonId, role: 'user', content: message.trim() })
      .select('id')
      .single();

    let useHistory = Array.isArray(history) ? history : null;
    if (!useHistory) {
      const { data: rows } = await supabaseAdmin
        .from('tutor_messages')
        .select('role, content')
        .eq('user_id', req.user.id)
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: false })
        .limit(12);
      useHistory = (rows || []).reverse().slice(0, -1);
    }

    let finalAnswer = '';
    let finalCitations = [];
    let sourcesBlock = '';
    let lowConfidence = false;

    for await (const ev of tutorAgent.answerStream({ lessonId, userId: req.user.id, message: message.trim(), history: useHistory })) {
      if (ev.type === 'citations') { finalCitations = ev.citations; send('citations', { citations: ev.citations }); }
      else if (ev.type === 'token') { send('token', { value: ev.value }); }
      else if (ev.type === 'done') { finalAnswer = ev.answer; sourcesBlock = ev.sources_block || ''; lowConfidence = !!ev.low_confidence; }
    }

    const { data: asstRow } = await supabaseAdmin
      .from('tutor_messages')
      .insert({ user_id: req.user.id, lesson_id: lessonId, role: 'assistant', content: finalAnswer, citations: finalCitations })
      .select('id')
      .single();

    // Groundedness scoring runs after the response — always on a low-confidence
    // answer, otherwise sampled — and writes grounded_score in the background.
    scoreAndPersistGroundedness(asstRow?.id, finalAnswer, sourcesBlock, { always: lowConfidence });

    send('done', {
      answer: finalAnswer,
      citations: finalCitations,
      low_confidence: lowConfidence,
      user_message_id: userRow?.id || null,
      assistant_message_id: asstRow?.id || null,
    });
    res.end();
  } catch (err) {
    console.error('[tutor stream] failed:', err?.message || err);
    // If nothing was written yet the headers are already sent, so report via SSE.
    send('error', { error: err?.message || 'Tutor failed' });
    res.end();
  }
});

/**
 * POST /api/tutor/messages/:id/feedback
 * Body: { value: 1 | -1 | 0 }  (0 clears)
 * Records a thumbs up/down on an assistant answer. Works for both lesson-tutor
 * and platform-assistant messages (same tutor_messages table). This is the seed
 * corpus for the Phase 6 fine-tune, so a thumbs-down also forces a groundedness
 * score on that turn.
 */
router.post('/messages/:id/feedback', authMiddleware, async (req, res) => {
  const raw = Number(req.body?.value);
  if (![1, -1, 0].includes(raw)) return error(res, 'value must be 1, -1, or 0');
  const feedback = raw === 0 ? null : raw;

  // Scope the update to the caller's own message — a user cannot rate another's.
  const { data: row, error: dbErr } = await supabaseAdmin
    .from('tutor_messages')
    .update({ feedback })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .eq('role', 'assistant')
    .select('id, content, citations, grounded_score')
    .maybeSingle();

  if (dbErr) return error(res, dbErr.message, 500);
  if (!row) return error(res, 'message not found', 404);

  // A thumbs-down is the strongest signal we have; make sure it gets scored even
  // if it wasn't in the earlier sample.
  if (feedback === -1 && row.grounded_score === null && Array.isArray(row.citations) && row.citations.length) {
    const sourcesBlock = row.citations.map((c) => `[${c.n}] (${c.lesson_title || 'lesson'}) ${c.preview || ''}`).join('\n\n');
    scoreAndPersistGroundedness(row.id, row.content, sourcesBlock, { always: true });
  }

  return success(res, { id: row.id, feedback });
});

module.exports = router;
