const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { success, error } = require('../utils/response');
const pyqAgent = require('../agents/pyqAgent');

// In-memory snapshot of cancellation requests, refreshed from `pyq_jobs.cancel_requested`
// at the start of each agent run. Avoids a DB query between every page fetch.
const cancelFlags = new Map(); // jobId → boolean

async function appendLog(jobId, entries) {
  if (!entries || entries.length === 0) return;
  const { data: row } = await supabaseAdmin
    .from('pyq_jobs')
    .select('log')
    .eq('id', jobId)
    .single();
  const existing = Array.isArray(row?.log) ? row.log : [];
  await supabaseAdmin
    .from('pyq_jobs')
    .update({ log: existing.concat(entries) })
    .eq('id', jobId);
}

async function runJob(jobId) {
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('pyq_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobErr || !job) {
    console.error('[pyq runJob] job not found:', jobId, jobErr?.message);
    return;
  }

  await supabaseAdmin
    .from('pyq_jobs')
    .update({ status: 'running' })
    .eq('id', jobId);

  cancelFlags.set(jobId, false);
  let totalInserted = 0;
  let totalAttempted = 0;
  let abortError = null;
  const buffered = [];
  let lastFlush = Date.now();
  let lastCountFlush = 0;

  const flushIfNeeded = async (force = false) => {
    if (buffered.length === 0) return;
    if (!force && Date.now() - lastFlush < 1500) return;
    const batch = buffered.splice(0, buffered.length);
    lastFlush = Date.now();
    try {
      await appendLog(jobId, batch);
    } catch (err) {
      console.warn('[pyq runJob] log append failed:', err.message);
    }
  };

  // Debounced counter flush. When `tentative` is null, use the committed
  // totals; when set, use the in-flight estimate (so the modal sees the
  // counter tick mid-year, before pyqAgent.run returns).
  const flushCounter = async (tentative = null, force = false) => {
    if (!force && Date.now() - lastCountFlush < 1000) return;
    lastCountFlush = Date.now();
    const insertedValue = tentative == null ? totalInserted : tentative;
    try {
      await supabaseAdmin
        .from('pyq_jobs')
        .update({ inserted: insertedValue, attempted: totalAttempted })
        .eq('id', jobId);
    } catch (err) {
      console.warn('[pyq runJob] counter flush failed:', err.message);
    }
  };

  try {

  // ── 1. Compute the gap (top-up semantics) ─────────────────────────
  let existingCount = 0;
  try {
    const { data: existing, error: countErr } = await supabaseAdmin
      .from('question_bank')
      .select('id')
      .eq('company_name', job.company_name)
      .eq('topic', job.topic)
      .eq('question_type', 'mcq');
    if (!countErr) existingCount = (existing || []).length;
  } catch (err) {
    console.warn('[pyq runJob] existing count failed:', err.message);
  }

  const need = Math.max(0, (job.target_count || 0) - existingCount);

  buffered.push({
    stage: 'planning',
    message: `Existing: ${existingCount} · Target: ${job.target_count} · Gap: ${need}`,
    count: 0,
    ts: new Date().toISOString(),
  });
  await flushIfNeeded(true);

    // Already at or above target → done.
    if (need === 0) {
      await supabaseAdmin
        .from('pyq_jobs')
        .update({
          status: 'succeeded',
          inserted: 0,
          attempted: 0,
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      return;
    }

    // ── 2. Distribute the gap evenly across selected years ───────────
    const years = Array.isArray(job.years) && job.years.length > 0 ? job.years : [null];
    const baseQuota = Math.floor(need / years.length);
    const remainder = need % years.length;
    const yearQuotas = years.map((y, i) => ({ year: y, quota: baseQuota + (i < remainder ? 1 : 0) }));

    // ── 3. Run per-year, abort on first insert error ─────────────────
    for (const { year, quota } of yearQuotas) {
      if (cancelFlags.get(jobId)) break;
      if (totalInserted >= need) break;
      if (quota <= 0) continue;

      // Re-balance: pick up any shortfall from previous years.
      const stillNeeded = need - totalInserted;
      const yearTarget = Math.min(quota + Math.max(0, stillNeeded - quota), stillNeeded);

      let result;
      try {
        result = await pyqAgent.run({
          company: job.company_name,
          topic: job.topic,
          year,
          target_count: yearTarget,
          onProgress: (entry) => {
            buffered.push({ year, ...entry });
            flushIfNeeded(false).catch(() => {});
            if (entry.stage === 'inserted' && typeof entry.count === 'number') {
              flushCounter(totalInserted + entry.count).catch(() => {});
            }
          },
          shouldCancel: () => cancelFlags.get(jobId) === true,
        });
      } catch (err) {
        abortError = `${year || 'no-year'}: ${err.message || String(err)}`;
        console.error('[pyq runJob] year', year, 'threw:', err.message);
        break;
      }

      totalInserted += result.inserted || 0;
      totalAttempted += result.attempted || 0;

      // Refresh cancel flag from DB at year boundaries.
      try {
        const { data: refreshed } = await supabaseAdmin
          .from('pyq_jobs')
          .select('cancel_requested')
          .eq('id', jobId)
          .single();
        if (refreshed?.cancel_requested) cancelFlags.set(jobId, true);
      } catch { /* best-effort */ }

      await flushCounter(null, true);

      // Abort on first insert failure — surface the exact error.
      if (result.error) {
        abortError = `${year || 'no-year'}: ${result.error}`;
        break;
      }
    }

    await flushIfNeeded(true);
    await flushCounter(null, true);

    // ── 4. Determine final status ────────────────────────────────────
    let finalStatus;
    let finalError = null;
    if (cancelFlags.get(jobId)) {
      finalStatus = 'cancelled';
    } else if (abortError) {
      finalStatus = totalInserted > 0 ? 'partial' : 'failed';
      finalError = abortError;
    } else if (totalInserted < need) {
      finalStatus = 'partial';
      finalError = `LLM produced only ${totalInserted}/${need} questions`;
    } else {
      finalStatus = 'succeeded';
    }

    await supabaseAdmin
      .from('pyq_jobs')
      .update({
        status: finalStatus,
        inserted: totalInserted,
        attempted: totalAttempted,
        error: finalError,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } finally {
    cancelFlags.delete(jobId);
  }
}

// All routes admin/teacher only.
router.use(authMiddleware, roleMiddleware('admin', 'teacher'));

/**
 * POST /api/admin/company-prep/pyq/seed
 * Body: { company, topic, years: number[], target_count?: number }
 */
router.post('/pyq/seed', async (req, res) => {
  const company = String(req.body?.company || '').trim();
  const topic = String(req.body?.topic || '').trim();
  const yearsRaw = Array.isArray(req.body?.years) ? req.body.years : [];
  const targetCount = Math.min(Math.max(Number(req.body?.target_count) || 30, 1), 100);

  if (!company) return error(res, 'company is required');
  if (!topic) return error(res, 'topic is required');

  const years = yearsRaw
    .map((y) => Number(y))
    .filter((y) => Number.isInteger(y) && y >= 2000 && y <= 2100);
  if (years.length === 0) return error(res, 'years[] must contain at least one integer between 2000 and 2100');

  // Validate company exists; topic must appear in at least one round's topics array.
  const { data: rounds, error: lookupErr } = await supabaseAdmin
    .from('company_rounds')
    .select('company_name, topics')
    .eq('company_name', company);

  if (lookupErr) return error(res, lookupErr.message, 500);
  if (!rounds || rounds.length === 0) return error(res, `Unknown company: ${company}`, 404);

  const topicMatches = rounds.some((r) => {
    const arr = Array.isArray(r.topics) ? r.topics : [];
    return arr.map(String).map((t) => t.toLowerCase()).includes(topic.toLowerCase());
  });
  if (!topicMatches) return error(res, `Topic "${topic}" not found in any round of "${company}"`, 404);

  const { data: job, error: insErr } = await supabaseAdmin
    .from('pyq_jobs')
    .insert({
      company_name: company,
      topic,
      years,
      target_count: targetCount,
      status: 'queued',
      triggered_by: req.user?.id || null,
    })
    .select('*')
    .single();

  if (insErr) return error(res, insErr.message, 500);

  // Fire-and-forget. setImmediate puts it on the next tick so the HTTP
  // response can flush first.
  setImmediate(() => {
    runJob(job.id).catch((err) => {
      console.error('[pyq runJob] unhandled error:', err);
      supabaseAdmin
        .from('pyq_jobs')
        .update({ status: 'failed', error: err.message || String(err), finished_at: new Date().toISOString() })
        .eq('id', job.id)
        .then(() => {});
    });
  });

  return success(res, { job_id: job.id, status: job.status }, 202);
});

/**
 * GET /api/admin/company-prep/pyq/jobs/:id
 */
router.get('/pyq/jobs/:id', async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('pyq_jobs')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (dbErr || !data) return error(res, 'Job not found', 404);
  return success(res, data);
});

/**
 * GET /api/admin/company-prep/pyq/jobs?company=&topic=
 */
router.get('/pyq/jobs', async (req, res) => {
  let query = supabaseAdmin
    .from('pyq_jobs')
    .select('id, company_name, topic, years, target_count, status, inserted, attempted, error, created_at, finished_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (req.query.company) query = query.eq('company_name', String(req.query.company));
  if (req.query.topic) query = query.eq('topic', String(req.query.topic));

  const { data, error: dbErr } = await query;
  if (dbErr) return error(res, dbErr.message, 500);
  return success(res, { jobs: data || [] });
});

/**
 * POST /api/admin/company-prep/pyq/jobs/:id/cancel
 */
router.post('/pyq/jobs/:id/cancel', async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('pyq_jobs')
    .update({ cancel_requested: true })
    .eq('id', req.params.id)
    .select('id, status')
    .single();

  if (dbErr || !data) return error(res, 'Job not found', 404);
  cancelFlags.set(req.params.id, true);
  return success(res, { job_id: data.id, status: data.status, cancel_requested: true });
});

module.exports = router;
