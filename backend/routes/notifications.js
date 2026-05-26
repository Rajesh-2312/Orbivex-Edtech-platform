const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { success, error } = require('../utils/response');

/**
 * GET /api/notifications
 * Query: ?limit=20&offset=0&unread_only=1
 */
router.get('/', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);
  const unreadOnly = req.query.unread_only === '1' || req.query.unread_only === 'true';

  let q = supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) q = q.eq('read', false);

  const { data, count, error: dbErr } = await q;
  if (dbErr) return error(res, dbErr.message, 500);

  // Also expose an unread count separate from the paginated set.
  const { count: unreadCount } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('read', false);

  return success(res, {
    items: data || [],
    total: count || 0,
    unread_count: unreadCount || 0,
    limit,
    offset,
  });
});

/**
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', authMiddleware, async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message, 500);
  return success(res, data);
});

/**
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', authMiddleware, async (req, res) => {
  const { error: dbErr } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', req.user.id)
    .eq('read', false);
  if (dbErr) return error(res, dbErr.message, 500);
  return success(res, { ok: true });
});

module.exports = router;
