const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { success, error } = require('../utils/response');
const { SOURCES, PYQ_SOURCES } = require('../utils/sources');
const topicNotesAgent = require('../agents/topicNotesAgent');
const quizAgent = require('../agents/quizAgent');

const QUESTION_SETS_TOTAL = 5;
const QUESTIONS_PER_SET = 30;

// Stable per-student set assignment: same student → same set on every request.
function setForStudent(studentId) {
  const h = crypto.createHash('sha1').update(String(studentId || '')).digest();
  return (h[0] % QUESTION_SETS_TOTAL) + 1;
}

/**
 * Group flat company_rounds rows into one object per company with rounds[].
 */
function groupCompanyRounds(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.company_slug)) {
      map.set(row.company_slug, {
        slug: row.company_slug,
        name: row.company_name,
        color: row.company_color,
        tier: row.company_tier,
        tagline: row.company_tagline,
        hiring: row.company_hiring,
        rounds: [],
      });
    }
    map.get(row.company_slug).rounds.push({
      id: row.id,
      round_index: row.round_index,
      title: row.title,
      summary: row.summary,
      duration_minutes: row.duration_minutes,
      topics: row.topics || [],
      test_paper_id: row.test_paper_id,
    });
  }
  // Sort rounds by index just in case the DB returns out of order.
  for (const c of map.values()) {
    c.rounds.sort((a, b) => a.round_index - b.round_index);
  }
  return Array.from(map.values());
}

/**
 * GET /api/company-prep/companies
 * List all companies with their rounds.
 */
router.get('/companies', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('company_rounds')
    .select('*')
    .order('company_slug')
    .order('round_index');

  if (dbError) return error(res, dbError.message);
  return success(res, groupCompanyRounds(data || []));
});

/**
 * GET /api/company-prep/progress
 * Returns the calling student's per-company progress as a map:
 *   { [slug]: { completed: number, completed_rounds: number[] } }
 */
router.get('/progress', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('company_round_progress')
    .select('company_slug, round_index, status')
    .eq('student_id', req.user.id)
    .eq('status', 'completed');

  if (dbError) return error(res, dbError.message);

  const map = {};
  for (const row of data || []) {
    if (!map[row.company_slug]) {
      map[row.company_slug] = { completed: 0, completed_rounds: [] };
    }
    map[row.company_slug].completed += 1;
    map[row.company_slug].completed_rounds.push(row.round_index);
  }
  return success(res, map);
});

/**
 * GET /api/company-prep/:slug
 * Get a single company with its rounds.
 */
router.get('/:slug', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('company_rounds')
    .select('*')
    .eq('company_slug', req.params.slug)
    .order('round_index');

  if (dbError) return error(res, dbError.message);
  if (!data || data.length === 0) return error(res, 'Company not found', 404);

  const [company] = groupCompanyRounds(data);
  return success(res, company);
});

/**
 * GET /api/company-prep/:slug/progress
 * Get the calling student's progress for a company.
 */
router.get('/:slug/progress', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('company_round_progress')
    .select('round_index, status, completed_at')
    .eq('student_id', req.user.id)
    .eq('company_slug', req.params.slug)
    .order('round_index');

  if (dbError) return error(res, dbError.message);

  const completed = (data || [])
    .filter((r) => r.status === 'completed')
    .map((r) => r.round_index);

  return success(res, {
    rounds: data || [],
    completed,
    completed_count: completed.length,
  });
});

/**
 * POST /api/company-prep/:slug/progress
 * Mark a round complete. Body: { round_index }
 */
router.post('/:slug/progress', authMiddleware, async (req, res) => {
  const { round_index } = req.body;
  if (round_index === undefined || round_index === null) {
    return error(res, 'round_index is required');
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('company_round_progress')
    .upsert({
      student_id: req.user.id,
      company_slug: req.params.slug,
      round_index,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }, { onConflict: 'student_id,company_slug,round_index' })
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data, 201);
});

/**
 * DELETE /api/company-prep/:slug/progress
 * Reset progress for a company.
 */
router.delete('/:slug/progress', authMiddleware, async (req, res) => {
  const { error: dbError } = await supabaseAdmin
    .from('company_round_progress')
    .delete()
    .eq('student_id', req.user.id)
    .eq('company_slug', req.params.slug);

  if (dbError) return error(res, dbError.message);
  return success(res, { reset: true });
});

/**
 * GET /api/company-prep/:slug/rounds/:index/attempts
 * List the calling student's attempts for a specific round.
 */
router.get('/:slug/rounds/:index/attempts', authMiddleware, async (req, res) => {
  const { slug, index } = req.params;

  const { data: round, error: roundErr } = await supabaseAdmin
    .from('company_rounds')
    .select('id')
    .eq('company_slug', slug)
    .eq('round_index', Number(index))
    .single();

  if (roundErr || !round) return error(res, 'Round not found', 404);

  const { data, error: dbError } = await supabaseAdmin
    .from('company_round_attempts')
    .select('*')
    .eq('student_id', req.user.id)
    .eq('company_round_id', round.id)
    .order('attempt_number', { ascending: false });

  if (dbError) return error(res, dbError.message);
  return success(res, data || []);
});

/**
 * POST /api/company-prep/:slug/rounds/:index/attempts
 * Record a new attempt. Body: { test_paper_id?, obtained_marks?, total_marks?, status? }
 */
router.post('/:slug/rounds/:index/attempts', authMiddleware, async (req, res) => {
  const { slug, index } = req.params;
  const { test_paper_id, obtained_marks, total_marks, status } = req.body;

  const { data: round, error: roundErr } = await supabaseAdmin
    .from('company_rounds')
    .select('id')
    .eq('company_slug', slug)
    .eq('round_index', Number(index))
    .single();

  if (roundErr || !round) return error(res, 'Round not found', 404);

  // Determine next attempt number for this (student, round).
  const { data: prior } = await supabaseAdmin
    .from('company_round_attempts')
    .select('attempt_number')
    .eq('student_id', req.user.id)
    .eq('company_round_id', round.id)
    .order('attempt_number', { ascending: false })
    .limit(1);

  const next = (prior?.[0]?.attempt_number || 0) + 1;
  const percentage = total_marks && obtained_marks != null
    ? Math.round((obtained_marks / total_marks) * 100)
    : null;

  const { data, error: dbError } = await supabaseAdmin
    .from('company_round_attempts')
    .insert({
      student_id: req.user.id,
      company_round_id: round.id,
      test_paper_id: test_paper_id || null,
      attempt_number: next,
      obtained_marks: obtained_marks ?? null,
      total_marks: total_marks ?? null,
      percentage,
      status: status || 'in_progress',
      submitted_at: status === 'submitted' || status === 'evaluated'
        ? new Date().toISOString()
        : null,
    })
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data, 201);
});

/**
 * POST /api/company-prep/practice/sessions
 * Start a practice session. Body: { company_name, category, topic?, company_round_id? }
 */
router.post('/practice/sessions', authMiddleware, async (req, res) => {
  const { company_name, category, topic, company_round_id } = req.body;
  if (!company_name || !category) {
    return error(res, 'company_name and category are required');
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('practice_sessions')
    .insert({
      student_id: req.user.id,
      company_name,
      category,
      topic: topic || null,
      company_round_id: company_round_id || null,
    })
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data, 201);
});

/**
 * POST /api/company-prep/practice/sessions/:id/responses
 * Submit a practice answer. Body: { question_id, selected_option, is_correct }
 */
router.post('/practice/sessions/:id/responses', authMiddleware, async (req, res) => {
  const { question_id, selected_option, is_correct } = req.body;
  if (!question_id) return error(res, 'question_id is required');

  const { data, error: dbError } = await supabaseAdmin
    .from('practice_responses')
    .insert({
      session_id: req.params.id,
      question_id,
      selected_option: selected_option ?? null,
      is_correct: is_correct ?? null,
    })
    .select()
    .single();

  if (dbError) return error(res, dbError.message);

  // Update session counters opportunistically.
  const { data: session } = await supabaseAdmin
    .from('practice_sessions')
    .select('questions_answered, correct_answers')
    .eq('id', req.params.id)
    .single();

  if (session) {
    await supabaseAdmin
      .from('practice_sessions')
      .update({
        questions_answered: (session.questions_answered || 0) + 1,
        correct_answers: (session.correct_answers || 0) + (is_correct ? 1 : 0),
      })
      .eq('id', req.params.id);
  }

  return success(res, data, 201);
});

/**
 * POST /api/company-prep/practice/sessions/:id/end
 * Mark a practice session as ended.
 */
router.post('/practice/sessions/:id/end', authMiddleware, async (req, res) => {
  const { session_minutes } = req.body;

  const { data, error: dbError } = await supabaseAdmin
    .from('practice_sessions')
    .update({
      ended_at: new Date().toISOString(),
      session_minutes: session_minutes ?? null,
    })
    .eq('id', req.params.id)
    .eq('student_id', req.user.id)
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data);
});

/**
 * POST /api/company-prep/admin/seed
 * Admin-only — seed/upsert company_rounds from a payload.
 * Body: { companies: [{ slug, name, color, tier, tagline, hiring,
 *                       rounds: [{ title, summary, duration_minutes, topics[] }] }] }
 */
router.post('/admin/seed', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const { companies } = req.body;
  if (!Array.isArray(companies) || companies.length === 0) {
    return error(res, 'companies[] is required');
  }

  const rows = [];
  for (const c of companies) {
    if (!c.slug || !c.name || !Array.isArray(c.rounds)) continue;
    c.rounds.forEach((r, i) => {
      rows.push({
        company_name: c.name,
        company_slug: c.slug,
        company_color: c.color || null,
        company_tier: c.tier || null,
        company_tagline: c.tagline || null,
        company_hiring: c.hiring || null,
        round_index: i,
        title: r.title,
        summary: r.summary || null,
        duration_minutes: r.duration_minutes ?? null,
        topics: r.topics || [],
      });
    });
  }

  if (rows.length === 0) return error(res, 'No valid rounds to seed');

  const { data, error: dbError } = await supabaseAdmin
    .from('company_rounds')
    .upsert(rows, { onConflict: 'company_slug,round_index' })
    .select();

  if (dbError) return error(res, dbError.message);
  return success(res, { seeded: data?.length || 0 }, 201);
});

/**
 * Helper — find a round row by (slug, index).
 */
async function loadRound(slug, roundIndex) {
  const { data, error: dbErr } = await supabaseAdmin
    .from('company_rounds')
    .select('company_name, title, summary')
    .eq('company_slug', slug)
    .eq('round_index', roundIndex)
    .single();
  return { data, error: dbErr };
}

/**
 * GET /api/company-prep/:slug/rounds/:index/topics/:topic/notes
 * Returns notes for a specific pace from the pool. Pure cache read — never
 * generates inline. If the requested pace is not seeded, returns
 * { success: true, data: { notes: null, available_paces: [...] } } so the
 * frontend can prompt the user to seed it.
 *
 * Query: ?pace=1..5 (default 3)
 */
router.get('/:slug/rounds/:index/topics/:topic/notes', authMiddleware, async (req, res) => {
  const slug = req.params.slug;
  const roundIndex = Number(req.params.index);
  const topic = decodeURIComponent(req.params.topic);
  const requestedPace = Number(req.query.pace) || 3;
  const pace = requestedPace >= 1 && requestedPace <= 5 ? requestedPace : 3;

  if (Number.isNaN(roundIndex)) return error(res, 'Invalid round index');

  const { data: round, error: roundErr } = await loadRound(slug, roundIndex);
  if (roundErr || !round) return error(res, 'Round not found', 404);

  // Pull every pace cached for this topic so we can tell the UI what's seeded.
  const { data: rows } = await supabaseAdmin
    .from('topic_notes')
    .select('pace_level, notes_json, model, updated_at')
    .eq('company_slug', slug)
    .eq('round_index', roundIndex)
    .eq('topic', topic);

  const availablePaces = (rows || []).map((r) => r.pace_level).sort((a, b) => a - b);
  const match = (rows || []).find((r) => r.pace_level === pace);

  if (!match) {
    return success(res, {
      notes: null,
      pace,
      available_paces: availablePaces,
      seeded: false,
    });
  }

  return success(res, {
    notes: match.notes_json,
    pace,
    available_paces: availablePaces,
    seeded: true,
    model: match.model,
    updated_at: match.updated_at,
  });
});

/**
 * POST /api/company-prep/:slug/rounds/:index/topics/:topic/notes/seed
 * Generates notes for ONE pace level and inserts into the pool.
 * Body: { pace: 1..5 } or query ?pace=N. Defaults to 3.
 * Returns the generated notes so the caller can render immediately.
 */
router.post('/:slug/rounds/:index/topics/:topic/notes/seed', authMiddleware, roleMiddleware('admin', 'teacher'), async (req, res) => {
  const slug = req.params.slug;
  const roundIndex = Number(req.params.index);
  const topic = decodeURIComponent(req.params.topic);
  const requestedPace = Number(req.body?.pace || req.query.pace) || 3;
  const pace = requestedPace >= 1 && requestedPace <= 5 ? requestedPace : 3;

  if (Number.isNaN(roundIndex)) return error(res, 'Invalid round index');

  const { data: round, error: roundErr } = await loadRound(slug, roundIndex);
  if (roundErr || !round) return error(res, 'Round not found', 404);

  let notes;
  try {
    notes = await topicNotesAgent.generate({
      topic,
      company: round.company_name,
      roundTitle: round.title,
      paceLevel: pace,
    });
  } catch (e) {
    return error(res, e.message || 'Failed to generate notes', 500);
  }

  const { data: saved, error: saveErr } = await supabaseAdmin
    .from('topic_notes')
    .upsert({
      company_slug: slug,
      round_index: roundIndex,
      topic,
      pace_level: pace,
      notes_json: notes,
      model: topicNotesAgent.model,
      generated_by: req.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_slug,round_index,topic,pace_level' })
    .select()
    .single();

  if (saveErr) {
    console.warn('topic_notes cache write failed:', saveErr.message);
    return success(res, { notes, pace, seeded: false, model: topicNotesAgent.model }, 201);
  }

  return success(res, {
    notes: saved.notes_json,
    pace,
    seeded: true,
    model: saved.model,
    updated_at: saved.updated_at,
  }, 201);
});

/**
 * POST /api/company-prep/:slug/rounds/:index/topics/:topic/notes/seed-all
 * Generates notes for ALL FIVE pace levels and stores them in the pool.
 * Long-running — expect ~30s × 5 paces. Returns once everything is saved.
 */
router.post('/:slug/rounds/:index/topics/:topic/notes/seed-all', authMiddleware, roleMiddleware('admin', 'teacher'), async (req, res) => {
  const slug = req.params.slug;
  const roundIndex = Number(req.params.index);
  const topic = decodeURIComponent(req.params.topic);

  if (Number.isNaN(roundIndex)) return error(res, 'Invalid round index');

  const { data: round, error: roundErr } = await loadRound(slug, roundIndex);
  if (roundErr || !round) return error(res, 'Round not found', 404);

  // Skip pace levels already cached so retries don't burn time on duplicates.
  const { data: existing } = await supabaseAdmin
    .from('topic_notes')
    .select('pace_level')
    .eq('company_slug', slug)
    .eq('round_index', roundIndex)
    .eq('topic', topic);

  const seededPaces = new Set((existing || []).map((r) => r.pace_level));
  const todo = [1, 2, 3, 4, 5].filter((p) => !seededPaces.has(p));

  const results = [];
  const failures = [];

  for (const pace of todo) {
    try {
      const notes = await topicNotesAgent.generate({
        topic,
        company: round.company_name,
        roundTitle: round.title,
        paceLevel: pace,
      });
      const { error: upErr } = await supabaseAdmin
        .from('topic_notes')
        .upsert({
          company_slug: slug,
          round_index: roundIndex,
          topic,
          pace_level: pace,
          notes_json: notes,
          model: topicNotesAgent.model,
          generated_by: req.user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_slug,round_index,topic,pace_level' });
      if (upErr) {
        failures.push({ pace, error: upErr.message });
      } else {
        results.push(pace);
      }
    } catch (e) {
      failures.push({ pace, error: e.message });
    }
  }

  return success(res, {
    seeded_now: results,
    already_seeded: Array.from(seededPaces).sort((a, b) => a - b),
    failures,
    total_in_pool: results.length + seededPaces.size,
  }, 201);
});

/**
 * GET /api/company-prep/:slug/rounds/:index/topics/:topic/questions
 * Returns MCQ practice questions for a topic from question_bank.
 *
 * Each student is deterministically assigned to one of 5 question sets via a
 * stable hash of their user id. We pull from that set first; if the set has
 * fewer rows than `limit`, top up from rows where set_number IS NULL (a
 * fallback pool, useful right after migration before all sets are seeded).
 *
 * Query: ?limit=30
 */
// Fisher-Yates in-place shuffle. Used for PYQ slice ordering.
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * GET /:slug/rounds/:index/topics/:topic/stats
 * Lightweight counts of MCQs in the question_bank for this (company, topic),
 * grouped by `source`. Used by the admin seed modal to show "X already exist"
 * and to compute the gap for top-up runs.
 */
router.get('/:slug/rounds/:index/topics/:topic/stats', authMiddleware, async (req, res) => {
  const slug = req.params.slug;
  const roundIndex = Number(req.params.index);
  const topic = decodeURIComponent(req.params.topic);

  if (Number.isNaN(roundIndex)) return error(res, 'Invalid round index');

  const { data: round } = await supabaseAdmin
    .from('company_rounds')
    .select('company_name')
    .eq('company_slug', slug)
    .eq('round_index', roundIndex)
    .single();
  if (!round) return error(res, 'Round not found', 404);

  // Tolerate pre-migration schemas where `source` may not exist yet.
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('question_bank')
      .select('source')
      .eq('company_name', round.company_name)
      .eq('topic', topic)
      .eq('question_type', 'mcq');

    if (!dbErr) {
      const rows = data || [];
      const bySource = rows.reduce((acc, r) => {
        const k = r.source || 'unknown';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      return success(res, {
        company: round.company_name,
        topic,
        total: rows.length,
        by_source: bySource,
      });
    }

    if (!/column .* does not exist/i.test(dbErr.message || '')) {
      return error(res, dbErr.message, 500);
    }

    // Pre-migration fallback: count only — never transfer row data.
    const { count, error: countErr } = await supabaseAdmin
      .from('question_bank')
      .select('id', { count: 'exact', head: true })
      .eq('company_name', round.company_name)
      .eq('topic', topic)
      .eq('question_type', 'mcq');
    if (countErr) return error(res, countErr.message, 500);
    return success(res, {
      company: round.company_name,
      topic,
      total: count || 0,
      by_source: { unknown: count || 0 },
    });
  } catch (err) {
    return error(res, err.message || String(err), 500);
  }
});

router.get('/:slug/rounds/:index/topics/:topic/questions', authMiddleware, async (req, res) => {
  const slug = req.params.slug;
  const roundIndex = Number(req.params.index);
  const topic = decodeURIComponent(req.params.topic);
  const limit = Math.min(Number(req.query.limit) || QUESTIONS_PER_SET, 50);

  if (Number.isNaN(roundIndex)) return error(res, 'Invalid round index');

  const { data: round } = await supabaseAdmin
    .from('company_rounds')
    .select('company_name, title')
    .eq('company_slug', slug)
    .eq('round_index', roundIndex)
    .single();

  if (!round) return error(res, 'Round not found', 404);

  const setNumber = setForStudent(req.user.id);
  let collected = [];
  let pyqCount = 0;
  let aiCount = 0;
  let usedLegacyPool = false; // schema lacks `source`/`set_number` columns

  // ── Step 1: PYQ slice (no set rotation — every student sees same shuffled pool).
  let pyqRows = [];
  try {
    const { data, error: pyqErr } = await supabaseAdmin
      .from('question_bank')
      .select('id, question_text, answers_json, difficulty_level, source, year_source')
      .eq('company_name', round.company_name)
      .eq('topic', topic)
      .eq('question_type', 'mcq')
      .in('source', PYQ_SOURCES);
    if (pyqErr) {
      // `source` column missing → migration not applied; fall through to legacy path silently.
      if (/column .* does not exist/i.test(pyqErr.message || '')) {
        usedLegacyPool = true;
      } else {
        console.warn('[company-prep questions] PYQ query failed:', pyqErr.message);
      }
    } else if (Array.isArray(data) && data.length > 0) {
      pyqRows = shuffleInPlace([...data]).slice(0, limit);
      collected.push(...pyqRows);
      pyqCount = pyqRows.length;
    }
  } catch (err) {
    console.warn('[company-prep questions] PYQ query threw:', err.message || err);
  }

  // ── Step 2: AI top-up (only fetched if PYQ pool didn't fill the limit).
  if (collected.length < limit) {
    const need = limit - collected.length;

    if (usedLegacyPool) {
      // Pre-migration fallback: pull whatever's there for this (company, topic).
      const { data: legacyRows, error: legacyErr } = await supabaseAdmin
        .from('question_bank')
        .select('id, question_text, answers_json, difficulty_level')
        .eq('company_name', round.company_name)
        .eq('topic', topic)
        .eq('question_type', 'mcq')
        .order('created_at', { ascending: true })
        .limit(need);
      if (legacyErr) {
        console.error('[company-prep questions] legacy pool query failed:', legacyErr.message || legacyErr);
        return error(res, `Question bank query failed: ${legacyErr.message || legacyErr}`, 500);
      }
      collected.push(...(legacyRows || []));
      aiCount = (legacyRows || []).length;
    } else {
      // Primary AI top-up: this student's assigned set.
      let aiRows = [];
      const { data: setRows, error: setErr } = await supabaseAdmin
        .from('question_bank')
        .select('id, question_text, answers_json, difficulty_level, source, year_source, set_number, created_at')
        .eq('company_name', round.company_name)
        .eq('topic', topic)
        .eq('question_type', 'mcq')
        .eq('source', SOURCES.AI_GENERATED)
        .eq('set_number', setNumber)
        .order('created_at', { ascending: true })
        .limit(need);
      if (setErr) {
        // Pre-migration: `set_number` / `source` column missing → fall through to legacy pool.
        if (/column .* does not exist/i.test(setErr.message || '')) {
          usedLegacyPool = true;
        } else {
          console.warn('[company-prep questions] AI set query failed:', setErr.message);
        }
      } else if (setRows) {
        aiRows.push(...setRows);
      }

      // Top up the AI slice from any AI-generated row (any set, including NULL)
      // if the student's set is short. This fixes the latent "stuck at 5" bug
      // where the original code only dipped into the NULL pool.
      if (aiRows.length < need) {
        const have = new Set(aiRows.map((r) => r.id));
        const remaining = need - aiRows.length;
        const { data: extraRows, error: extraErr } = await supabaseAdmin
          .from('question_bank')
          .select('id, question_text, answers_json, difficulty_level, source, year_source, set_number, created_at')
          .eq('company_name', round.company_name)
          .eq('topic', topic)
          .eq('question_type', 'mcq')
          .eq('source', SOURCES.AI_GENERATED)
          .order('created_at', { ascending: true })
          .limit(remaining + aiRows.length); // overfetch in case of overlap
        if (extraErr) {
          if (!/column .* does not exist/i.test(extraErr.message || '')) {
            console.warn('[company-prep questions] AI top-up query failed:', extraErr.message);
          }
        } else if (extraRows) {
          for (const row of extraRows) {
            if (aiRows.length >= need) break;
            if (!have.has(row.id)) {
              aiRows.push(row);
              have.add(row.id);
            }
          }
        }
      }

      collected.push(...aiRows);
      aiCount = aiRows.length;
    }
  }

  const sanitised = collected.map((row) => ({
    id: row.id,
    question_text: row.question_text,
    options: row.answers_json?.options || [],
    difficulty_level: row.difficulty_level,
    source: row.source || (usedLegacyPool ? null : 'ai-generated'),
    year_source: row.year_source || null,
  }));

  const needsSeeding = collected.length < limit || pyqCount === 0;

  return success(res, {
    questions: sanitised,
    source: 'question_bank',
    company: round.company_name,
    topic,
    pyq_count: pyqCount,
    ai_count: aiCount,
    total_in_set: collected.length,
    needs_seeding: needsSeeding,
    // Diagnostic only — student UI hides the Set pill when pyq_count > 0.
    set_number: pyqCount >= limit || usedLegacyPool ? null : setNumber,
    total_sets: QUESTION_SETS_TOTAL,
  });
});

/**
 * Internal: generate `count` MCQs for a (round, topic), dedup against any
 * existing rows in `existingKeys` (lowercased question text), and insert
 * tagged with `setNumber` (or NULL for the legacy untagged pool).
 *
 * Returns { inserted: number, error?: string }.
 */
async function generateQuestionsForSet({ round, topic, count, setNumber, existingKeys }) {
  const seedContent = `Topic: ${topic}\nCompany: ${round.company_name}\nRound: ${round.title}\nContext: ${round.summary || ''}\n\nGenerate placement-prep style MCQs at intermediate difficulty.`;

  // quizAgent caps each call at 5 for the small model; batch to reach `count`.
  const BATCH_SIZE = 5;
  const seen = new Set(existingKeys || []);
  const questions = [];
  let lastError = null;

  for (let i = 0; i < Math.ceil(count / BATCH_SIZE) && questions.length < count; i++) {
    const need = Math.min(BATCH_SIZE, count - questions.length);
    try {
      const batch = await quizAgent.generate(seedContent, need);
      for (const q of batch || []) {
        const key = (q.question || '').trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        questions.push(q);
        if (questions.length >= count) break;
      }
    } catch (e) {
      lastError = e;
      // keep going — partial batches are still useful
    }
  }

  if (questions.length === 0) {
    return { inserted: 0, error: lastError?.message || 'Failed to generate questions' };
  }

  const rows = questions.map((q) => ({
    question_text: q.question,
    question_type: 'mcq',
    difficulty_level: 'medium',
    category: 'aptitude',
    test_type: 'company-specific',
    company_name: round.company_name,
    topic,
    set_number: setNumber || null,
    answers_json: {
      options: q.options || [],
      correct_answer: q.correct_answer,
      explanation: q.explanation,
    },
  }));

  let inserted = null;
  let insErr = null;

  ({ data: inserted, error: insErr } = await supabaseAdmin
    .from('question_bank')
    .insert(rows)
    .select('id, question_text, answers_json, difficulty_level, set_number'));

  if (insErr && /set_number/.test(insErr.message || '')) {
    // Schema is still the legacy pool without set_number.
    const fallbackRows = rows.map(({ set_number, ...rest }) => rest);
    ({ data: inserted, error: insErr } = await supabaseAdmin
      .from('question_bank')
      .insert(fallbackRows)
      .select('id, question_text, answers_json, difficulty_level'));
  }

  if (insErr) return { inserted: 0, error: insErr.message };
  return { inserted: inserted || [], count: (inserted || []).length };
}

/**
 * POST /api/company-prep/:slug/rounds/:index/topics/:topic/questions/generate
 * Generates AI MCQs and inserts them into question_bank for this (company, topic).
 * Body: { count?: number, set?: 1..5 }
 *
 * If `set` is supplied, generated rows are tagged with that set_number; otherwise
 * they're inserted with set_number = NULL (legacy pool, used as fallback).
 */
router.post('/:slug/rounds/:index/topics/:topic/questions/generate', authMiddleware, roleMiddleware('admin', 'teacher'), async (req, res) => {
  const slug = req.params.slug;
  const roundIndex = Number(req.params.index);
  const topic = decodeURIComponent(req.params.topic);
  const count = Math.min(Number(req.body?.count) || QUESTIONS_PER_SET, QUESTIONS_PER_SET);

  const requestedSet = Number(req.body?.set || req.query.set);
  const setNumber = requestedSet >= 1 && requestedSet <= QUESTION_SETS_TOTAL ? requestedSet : null;
  if (req.body?.set != null && setNumber === null) {
    return error(res, `Invalid set: must be 1..${QUESTION_SETS_TOTAL}`);
  }

  const { data: round } = await supabaseAdmin
    .from('company_rounds')
    .select('company_name, title, summary')
    .eq('company_slug', slug)
    .eq('round_index', roundIndex)
    .single();

  if (!round) return error(res, 'Round not found', 404);

  // Pull existing questions for this (company, topic) so we can dedup across
  // sets — sharing duplicates between sets defeats the whole point.
  const { data: existing } = await supabaseAdmin
    .from('question_bank')
    .select('question_text')
    .eq('company_name', round.company_name)
    .eq('topic', topic)
    .eq('question_type', 'mcq');
  const existingKeys = (existing || []).map((r) => (r.question_text || '').trim().toLowerCase());

  const result = await generateQuestionsForSet({ round, topic, count, setNumber, existingKeys });
  if (result.error && (!result.inserted || result.count === 0)) {
    return error(res, result.error, 500);
  }

  const sanitised = (result.inserted || []).map((row) => ({
    id: row.id,
    question_text: row.question_text,
    options: row.answers_json?.options || [],
    difficulty_level: row.difficulty_level,
    set_number: row.set_number,
  }));

  return success(res, {
    questions: sanitised,
    generated: sanitised.length,
    set_number: setNumber,
  }, 201);
});

/**
 * POST /api/company-prep/:slug/rounds/:index/topics/:topic/questions/generate-all-sets
 * Generates MCQs for ALL FIVE sets (default 30 per set = 150 total).
 * Idempotent — sets that already have >= count_per_set rows are skipped.
 *
 * Body: { count_per_set?: number } (default 30)
 *
 * Long-running: ~30s per batch of 5 × ~6 batches per set × 5 sets ≈ 5–10 min
 * for a fully empty topic. Frontend should show progress.
 */
router.post('/:slug/rounds/:index/topics/:topic/questions/generate-all-sets', authMiddleware, roleMiddleware('admin', 'teacher'), async (req, res) => {
  const slug = req.params.slug;
  const roundIndex = Number(req.params.index);
  const topic = decodeURIComponent(req.params.topic);
  const countPerSet = Math.min(Number(req.body?.count_per_set) || QUESTIONS_PER_SET, QUESTIONS_PER_SET);

  const { data: round } = await supabaseAdmin
    .from('company_rounds')
    .select('company_name, title, summary')
    .eq('company_slug', slug)
    .eq('round_index', roundIndex)
    .single();

  if (!round) return error(res, 'Round not found', 404);

  // Count how many questions each set already has.
  let existingRows = null;
  let countQueryError = null;

  try {
    const result = await supabaseAdmin
      .from('question_bank')
      .select('question_text, set_number')
      .eq('company_name', round.company_name)
      .eq('topic', topic)
      .eq('question_type', 'mcq');
    existingRows = result.data;
    countQueryError = result.error;
  } catch (err) {
    countQueryError = err;
  }

  if (countQueryError && /set_number/.test(countQueryError.message || '')) {
    console.warn('[company-prep generate-all-sets] set_number missing, using legacy question pool');
    const result = await supabaseAdmin
      .from('question_bank')
      .select('question_text')
      .eq('company_name', round.company_name)
      .eq('topic', topic)
      .eq('question_type', 'mcq');
    existingRows = result.data || [];
  }

  const perSetCount = new Map();
  const existingKeys = [];
  for (const row of existingRows || []) {
    const key = (row.question_text || '').trim().toLowerCase();
    if (key) existingKeys.push(key);
    if (row.set_number != null) {
      perSetCount.set(row.set_number, (perSetCount.get(row.set_number) || 0) + 1);
    }
  }

  const seededNow = {};
  const alreadyFull = [];
  const failures = [];

  for (let setN = 1; setN <= QUESTION_SETS_TOTAL; setN++) {
    const have = perSetCount.get(setN) || 0;
    if (have >= countPerSet) {
      alreadyFull.push(setN);
      continue;
    }
    const need = countPerSet - have;
    const result = await generateQuestionsForSet({
      round,
      topic,
      count: need,
      setNumber: setN,
      existingKeys, // accumulates across sets so duplicates aren't generated
    });
    if (result.error && (!result.count)) {
      failures.push({ set: setN, error: result.error });
      continue;
    }
    seededNow[setN] = result.count;
    for (const r of result.inserted || []) {
      const k = (r.question_text || '').trim().toLowerCase();
      if (k) existingKeys.push(k);
    }
  }

  return success(res, {
    seeded_now: seededNow,
    already_full: alreadyFull,
    failures,
    total_sets: QUESTION_SETS_TOTAL,
    target_per_set: countPerSet,
  }, 201);
});

/**
 * POST /api/company-prep/practice/grade
 * Grades a set of practice answers against question_bank. Body:
 *   { answers: [{ question_id, selected_option }] }
 * Returns per-question correctness + total score. Does not persist by itself —
 * caller can wrap this in a practice_session if they want to record history.
 */
router.post('/practice/grade', authMiddleware, async (req, res) => {
  const { answers } = req.body || {};
  if (!Array.isArray(answers) || answers.length === 0) {
    return error(res, 'answers[] is required');
  }

  const ids = answers.map((a) => a.question_id).filter(Boolean);
  const { data: rows, error: dbErr } = await supabaseAdmin
    .from('question_bank')
    .select('id, answers_json')
    .in('id', ids);

  if (dbErr) return error(res, dbErr.message);

  const byId = new Map((rows || []).map((r) => [r.id, r]));
  let correct = 0;
  const results = answers.map((a) => {
    const row = byId.get(a.question_id);
    const expected = row?.answers_json?.correct_answer;
    const selected = a.selected_option;
    // correct_answer is sometimes the letter ("A"), sometimes the option text — accept both.
    const isCorrect = expected != null && selected != null
      && String(expected).trim().toLowerCase() === String(selected).trim().toLowerCase();
    if (isCorrect) correct += 1;
    return {
      question_id: a.question_id,
      selected_option: selected,
      correct_answer: expected,
      explanation: row?.answers_json?.explanation || null,
      is_correct: isCorrect,
    };
  });

  return success(res, {
    results,
    correct,
    total: answers.length,
    percentage: answers.length ? Math.round((correct / answers.length) * 100) : 0,
  });
});

module.exports = router;
