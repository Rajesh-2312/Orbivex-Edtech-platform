const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const { tutorLimiter } = require('../middleware/rateLimiter');
const { supabaseAdmin } = require('../config/supabase');
const { success, error } = require('../utils/response');
const assistant = require('../agents/assistantAgent');
const { scoreAndPersistGroundedness } = require('../agents/verifier');

/**
 * GET /api/assistant/history?session_id=...
 * Platform-scoped assistant messages for this user (optionally one session).
 */
router.get('/history', authMiddleware, async (req, res) => {
  let q = supabaseAdmin
    .from('tutor_messages')
    .select('id, role, content, citations, tool_calls, created_at')
    .eq('user_id', req.user.id)
    .eq('scope', 'platform')
    .order('created_at', { ascending: true })
    .limit(100);
  if (req.query.session_id) q = q.eq('session_id', req.query.session_id);
  const { data, error: dbErr } = await q;
  if (dbErr) return error(res, dbErr.message, 500);
  return success(res, data || []);
});

/**
 * POST /api/assistant/chat/stream
 * Body: { message, session_id?, history? }
 * Streams the assistant turn as SSE (status/tool/confirm/citations/token/done).
 */
router.post('/chat/stream', authMiddleware, tutorLimiter, async (req, res) => {
  const { message, history } = req.body || {};
  const sessionId = req.body?.session_id || crypto.randomUUID();
  if (!message || typeof message !== 'string' || !message.trim()) {
    return error(res, 'message is required');
  }
  if (message.length > 2000) return error(res, 'message too long (max 2000 chars)');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const startedAt = Date.now();

  try {
    await supabaseAdmin.from('tutor_messages').insert({
      user_id: req.user.id, lesson_id: null, scope: 'platform', session_id: sessionId,
      role: 'user', content: message.trim(),
    });

    // Hydrate recent platform history if the client didn't pass any.
    let useHistory = Array.isArray(history) ? history : null;
    if (!useHistory) {
      const { data: rows } = await supabaseAdmin
        .from('tutor_messages')
        .select('role, content')
        .eq('user_id', req.user.id).eq('scope', 'platform')
        .order('created_at', { ascending: false }).limit(10);
      useHistory = (rows || []).reverse().slice(0, -1);
    }

    let finalAnswer = '';
    let finalCitations = [];
    let toolCalls = [];
    let pending = null;
    let sourcesBlock = '';
    let lowConfidence = false;

    for await (const ev of assistant.answerStream({ user: req.user, message: message.trim(), history: useHistory })) {
      if (ev.type === 'citations') finalCitations = ev.citations;
      if (ev.type === 'done') {
        finalAnswer = ev.answer; toolCalls = ev.tool_calls || []; pending = ev.pending_confirmation || null;
        sourcesBlock = ev.sources_block || ''; lowConfidence = !!ev.low_confidence;
      }
      // Forward everything except the terminal 'done' (sent explicitly below).
      if (ev.type !== 'done') send(ev.type, ev);
    }

    const { data: asstRow } = await supabaseAdmin.from('tutor_messages').insert({
      user_id: req.user.id, lesson_id: null, scope: 'platform', session_id: sessionId,
      role: 'assistant', content: finalAnswer, citations: finalCitations,
      tool_calls: toolCalls, latency_ms: Date.now() - startedAt,
    }).select('id').single();

    scoreAndPersistGroundedness(asstRow?.id, finalAnswer, sourcesBlock, { always: lowConfidence });

    send('done', {
      answer: finalAnswer,
      citations: finalCitations,
      tool_calls: toolCalls,
      pending_confirmation: pending,
      low_confidence: lowConfidence,
      session_id: sessionId,
      assistant_message_id: asstRow?.id || null,
    });
    res.end();
  } catch (err) {
    console.error('[assistant stream] failed:', err?.message || err);
    send('error', { error: err?.message || 'Assistant failed' });
    res.end();
  }
});

/**
 * POST /api/assistant/confirm
 * Body: { name, args } — execute a write the assistant previously proposed.
 */
router.post('/confirm', authMiddleware, tutorLimiter, async (req, res) => {
  const { name, args } = req.body || {};
  if (!name) return error(res, 'tool name is required');
  try {
    const result = await assistant.confirmTool({ user: req.user, name, args: args || {} });
    if (!result.ok) return error(res, result.error || 'Action failed', 400);
    return success(res, result.result);
  } catch (err) {
    return error(res, err?.message || 'Action failed', 500);
  }
});

module.exports = router;
