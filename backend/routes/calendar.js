const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { success, error } = require('../utils/response');

function clampIso(v, fallback) {
  if (!v) return fallback;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function withinRange(starts_at, fromIso, toIso) {
  if (!starts_at) return false;
  const t = new Date(starts_at).getTime();
  return t >= new Date(fromIso).getTime() && t <= new Date(toIso).getTime();
}

async function queryCalendar({ userId, fromIso, toIso }) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, college_id, branch_id, section_id, role')
    .eq('id', userId)
    .single();
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  // ── Source A: calendar_events ─────────────────────────────────
  // Broad pull within range, scope-filtered in Node — the OR-with-NULL
  // semantics are awkward in PostgREST.
  const { data: rawEvents } = await supabaseAdmin
    .from('calendar_events')
    .select('*')
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso)
    .order('starts_at', { ascending: true })
    .limit(500);

  const scopeMatches = (row) => {
    if (row.user_id && row.user_id === profile.id) return true;
    if (row.user_id && row.user_id !== profile.id) return false;
    if (row.college_id && row.college_id !== profile.college_id) return false;
    if (row.branch_id  && row.branch_id  !== profile.branch_id)  return false;
    if (row.section_id && row.section_id !== profile.section_id) return false;
    return true;
  };

  const eventRows = (rawEvents || []).filter(scopeMatches).map((row) => ({
    id: `evt:${row.id}`,
    type: row.type,
    title: row.title,
    description: row.description,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    all_day: row.all_day,
    source: 'calendar_events',
    action_url: row.test_paper_id ? `/tests/${row.test_paper_id}`
              : row.course_id ? `/courses/${row.course_id}`
              : null,
  }));

  // ── Source B: published test_papers (de-duped against linked calendar rows) ──
  const { data: tests } = await supabaseAdmin
    .from('test_papers')
    .select('id, title, description, test_type, scheduled_date, scheduled_end_time, college_id, branch_id, section_id, status, is_published')
    .eq('is_published', true)
    .not('scheduled_date', 'is', null)
    .gte('scheduled_date', fromIso)
    .lte('scheduled_date', toIso)
    .order('scheduled_date', { ascending: true })
    .limit(300);

  const linkedTestIds = new Set((rawEvents || []).filter((r) => r.test_paper_id).map((r) => r.test_paper_id));
  const testRows = (tests || [])
    .filter((t) => !linkedTestIds.has(t.id))
    .filter((t) => {
      if (t.college_id && t.college_id !== profile.college_id) return false;
      if (t.branch_id  && t.branch_id  !== profile.branch_id)  return false;
      if (t.section_id && t.section_id !== profile.section_id) return false;
      return true;
    })
    .map((t) => ({
      id: `test:${t.id}`,
      type: 'exam',
      title: t.title,
      description: t.description,
      starts_at: t.scheduled_date,
      ends_at: t.scheduled_end_time,
      all_day: false,
      source: 'test_papers',
      action_url: `/tests/${t.id}`,
    }));

  return [...eventRows, ...testRows]
    .filter((r) => withinRange(r.starts_at, fromIso, toIso))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}

/**
 * GET /api/calendar?from=ISO&to=ISO
 */
router.get('/', authMiddleware, async (req, res) => {
  const now = Date.now();
  const fromIso = clampIso(req.query.from, new Date(now - 30 * 86400_000).toISOString());
  const toIso   = clampIso(req.query.to,   new Date(now + 60 * 86400_000).toISOString());

  try {
    const items = await queryCalendar({ userId: req.user.id, fromIso, toIso });
    return success(res, { items, from: fromIso, to: toIso });
  } catch (err) {
    console.error('[calendar] failed:', err?.message || err);
    return error(res, err?.message || 'Calendar query failed', err?.status || 500);
  }
});

/**
 * GET /api/calendar/upcoming?days=7
 */
router.get('/upcoming', authMiddleware, async (req, res) => {
  const days = Math.min(parseInt(req.query.days || '7', 10), 30);
  const fromIso = new Date().toISOString();
  const toIso = new Date(Date.now() + days * 86400_000).toISOString();
  try {
    const items = await queryCalendar({ userId: req.user.id, fromIso, toIso });
    return success(res, { items, from: fromIso, to: toIso });
  } catch (err) {
    console.error('[calendar] failed:', err?.message || err);
    return error(res, err?.message || 'Calendar query failed', err?.status || 500);
  }
});

module.exports = router;
