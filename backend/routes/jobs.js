const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { success, error } = require('../utils/response');
const { notify } = require('../utils/notifications');

/**
 * GET /api/jobs
 * List active jobs.
 */
router.get('/', async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (dbError) return error(res, dbError.message);
  return success(res, data);
});

/**
 * GET /api/jobs/:id
 * Get a single job.
 */
router.get('/:id', async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('jobs')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (dbError) return error(res, 'Job not found', 404);
  return success(res, data);
});

/**
 * POST /api/jobs
 * Post a new job (teacher/admin only).
 */
router.post('/', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res) => {
  const { title, company, description, location, job_type } = req.body;
  if (!title) return error(res, 'Title is required');

  const { data, error: dbError } = await supabaseAdmin
    .from('jobs')
    .insert({
      title,
      company,
      description,
      location,
      job_type: job_type || 'full-time',
      posted_by: req.user.id,
    })
    .select()
    .single();

  if (dbError) return error(res, dbError.message);
  return success(res, data, 201);
});

/**
 * POST /api/jobs/:id/apply
 * Apply for a job.
 */
router.post('/:id/apply', authMiddleware, async (req, res) => {
  const { cover_letter } = req.body;

  const { data, error: dbError } = await supabaseAdmin
    .from('applications')
    .insert({
      user_id: req.user.id,
      job_id: req.params.id,
      cover_letter,
    })
    .select()
    .single();

  if (dbError) {
    if (dbError.code === '23505') return error(res, 'Already applied to this job');
    return error(res, dbError.message);
  }

  // Confirmation notification for the applicant.
  notify({
    userId: req.user.id,
    type: 'application_status',
    title: 'Application received',
    message: 'We received your application. You\'ll be notified when the status changes.',
    entityType: 'application',
    entityId: data.id,
    actionUrl: '/jobs',
  }).catch(() => {});

  return success(res, data, 201);
});

/**
 * PATCH /api/jobs/:jobId/applications/:appId/status
 * Update an application's status. Teacher/admin only. Notifies the applicant.
 */
router.patch('/:jobId/applications/:appId/status', authMiddleware, roleMiddleware('teacher', 'admin'), async (req, res) => {
  const { status } = req.body || {};
  const allowed = ['pending', 'reviewing', 'shortlisted', 'rejected', 'hired'];
  if (!status || !allowed.includes(status)) {
    return error(res, `status must be one of ${allowed.join(', ')}`);
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('applications')
    .update({ status })
    .eq('id', req.params.appId)
    .eq('job_id', req.params.jobId)
    .select('*, jobs(title, company)')
    .single();
  if (dbErr) return error(res, dbErr.message);
  if (!data) return error(res, 'Application not found', 404);

  notify({
    userId: data.user_id,
    type: 'application_status',
    title: `Application ${status}`,
    message: `Your application for ${data.jobs?.title || 'a role'}${data.jobs?.company ? ' at ' + data.jobs.company : ''} is now "${status}".`,
    entityType: 'application',
    entityId: data.id,
    actionUrl: '/jobs',
  }).catch(() => {});

  return success(res, data);
});

/**
 * GET /api/jobs/my/applications
 * Get current user's applications.
 */
router.get('/my/applications', authMiddleware, async (req, res) => {
  const { data, error: dbError } = await supabaseAdmin
    .from('applications')
    .select('*, jobs(*)')
    .eq('user_id', req.user.id)
    .order('applied_at', { ascending: false });

  if (dbError) return error(res, dbError.message);
  return success(res, data);
});

module.exports = router;
