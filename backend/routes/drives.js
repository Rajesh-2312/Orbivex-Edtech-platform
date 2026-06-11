/**
 * Placement Drives API  —  /api/drives
 *
 * Roles:
 *   admin / tpo  → full CRUD
 *   teacher      → read + limited write (own drives)
 *   student      → read drives they are eligible for, register interest
 */
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { success, error } = require('../utils/response');
const { notify } = require('../utils/notifications');

const MANAGE_ROLES = ['admin', 'tpo'];

/* ─────────────────────────────────────────────────────────────
   DRIVES CRUD
───────────────────────────────────────────────────────────── */

/**
 * GET /api/drives
 * - admin/tpo: all drives for their college
 * - student:  drives where they are eligible
 */
router.get('/', authMiddleware, async (req, res) => {
  const { college_id, status, upcoming } = req.query;

  if (['admin', 'tpo', 'teacher'].includes(req.user.role)) {
    let query = supabaseAdmin
      .from('placement_drives')
      .select(`
        *,
        colleges(name, code),
        branches(name, code),
        drive_offers(count),
        drive_eligible_students(count)
      `)
      .order('drive_date', { ascending: false });

    if (college_id) query = query.eq('college_id', college_id);
    if (status) query = query.eq('status', status);
    if (upcoming === 'true') query = query.gte('drive_date', new Date().toISOString().split('T')[0]);

    const { data, error: dbErr } = await query;
    if (dbErr) return error(res, dbErr.message);
    return success(res, data || []);
  }

  // Student: get drives they are eligible for
  const { data: eligibleRows } = await supabaseAdmin
    .from('drive_eligible_students')
    .select('drive_id, registered')
    .eq('student_id', req.user.id);

  const driveIds = (eligibleRows || []).map(r => r.drive_id);
  const registeredMap = {};
  (eligibleRows || []).forEach(r => { registeredMap[r.drive_id] = r.registered; });

  if (driveIds.length === 0) return success(res, []);

  const { data: drives, error: dbErr } = await supabaseAdmin
    .from('placement_drives')
    .select('*, colleges(name), branches(name)')
    .in('id', driveIds)
    .order('drive_date', { ascending: false });

  if (dbErr) return error(res, dbErr.message);

  const enriched = (drives || []).map(d => ({
    ...d,
    registered: registeredMap[d.id] || false,
  }));

  return success(res, enriched);
});

/**
 * GET /api/drives/:id
 */
router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('placement_drives')
    .select(`
      *,
      colleges(name, code),
      branches(name, code),
      sections(section_name),
      drive_selection_rounds(* ORDER BY round_number ASC),
      drive_offers(count),
      drive_eligible_students(count)
    `)
    .eq('id', req.params.id)
    .single();

  if (dbErr) return error(res, 'Drive not found', 404);
  return success(res, data);
});

/**
 * POST /api/drives
 * Create a new placement drive.
 */
router.post('/', authMiddleware, roleMiddleware(...MANAGE_ROLES), async (req, res) => {
  const {
    college_id, branch_id, section_id, company_name, company_logo_url,
    drive_date, drive_type, job_role, job_type, location,
    ctc_min, ctc_max, description,
    eligibility_cgpa, eligibility_backlogs, eligibility_batch,
    rounds,
  } = req.body;

  if (!company_name || !drive_date || !job_role || !college_id) {
    return error(res, 'company_name, drive_date, job_role, college_id are required');
  }

  const { data: drive, error: dbErr } = await supabaseAdmin
    .from('placement_drives')
    .insert({
      college_id, branch_id: branch_id || null, section_id: section_id || null,
      company_name, company_logo_url: company_logo_url || null,
      drive_date, drive_type: drive_type || 'on-campus',
      job_role, job_type: job_type || 'full-time',
      location: location || null,
      ctc_min: ctc_min || null, ctc_max: ctc_max || null,
      description: description || null,
      eligibility_cgpa: eligibility_cgpa || 0,
      eligibility_backlogs: eligibility_backlogs ?? 999,
      eligibility_batch: eligibility_batch || null,
      posted_by: req.user.id,
    })
    .select()
    .single();

  if (dbErr) return error(res, dbErr.message);

  // If round definitions were passed, insert them
  if (Array.isArray(rounds) && rounds.length > 0) {
    const roundRows = rounds.map((r, i) => ({
      drive_id: drive.id,
      round_number: i + 1,
      round_name: r.round_name || `Round ${i + 1}`,
      round_date: r.round_date || null,
      venue: r.venue || null,
      notes: r.notes || null,
    }));
    await supabaseAdmin.from('drive_selection_rounds').insert(roundRows);
  }

  return success(res, drive, 201);
});

/**
 * PATCH /api/drives/:id
 */
router.patch('/:id', authMiddleware, roleMiddleware(...MANAGE_ROLES), async (req, res) => {
  const allowed = [
    'company_name', 'company_logo_url', 'drive_date', 'drive_type', 'job_role',
    'job_type', 'location', 'ctc_min', 'ctc_max', 'description', 'status',
    'eligibility_cgpa', 'eligibility_backlogs', 'eligibility_batch',
    'branch_id', 'section_id',
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('placement_drives')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (dbErr) return error(res, dbErr.message);
  return success(res, data);
});

/**
 * DELETE /api/drives/:id
 */
router.delete('/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const { error: dbErr } = await supabaseAdmin
    .from('placement_drives')
    .delete()
    .eq('id', req.params.id);

  if (dbErr) return error(res, dbErr.message);
  return success(res, { deleted: true });
});

/* ─────────────────────────────────────────────────────────────
   ELIGIBLE STUDENTS
───────────────────────────────────────────────────────────── */

/**
 * GET /api/drives/:id/eligible
 * List eligible students for a drive.
 */
router.get('/:id/eligible', authMiddleware, roleMiddleware(...MANAGE_ROLES, 'teacher'), async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('drive_eligible_students')
    .select(`
      *,
      student:profiles!student_id(
        id, display_name, username, enrollment_number, hall_ticket_number,
        college_id, branch_id, section_id,
        colleges(name), branches(name), sections(section_name)
      )
    `)
    .eq('drive_id', req.params.id)
    .order('created_at');

  if (dbErr) return error(res, dbErr.message);
  return success(res, data || []);
});

/**
 * POST /api/drives/:id/eligible
 * Add students to eligible list. Body: { student_ids: [] } or { auto: true, college_id, branch_id }
 * With auto=true, auto-adds all students from that college/branch.
 */
router.post('/:id/eligible', authMiddleware, roleMiddleware(...MANAGE_ROLES), async (req, res) => {
  const { student_ids, auto, college_id, branch_id, section_id } = req.body;

  let ids = student_ids || [];

  if (auto) {
    let query = supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'student');

    if (college_id) query = query.eq('college_id', college_id);
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (section_id) query = query.eq('section_id', section_id);

    const { data: students } = await query;
    ids = (students || []).map(s => s.id);
  }

  if (ids.length === 0) return error(res, 'No students to add');

  const rows = ids.map(sid => ({
    drive_id: req.params.id,
    student_id: sid,
    registered: false,
  }));

  const { data, error: dbErr } = await supabaseAdmin
    .from('drive_eligible_students')
    .upsert(rows, { onConflict: 'drive_id,student_id' })
    .select();

  if (dbErr) return error(res, dbErr.message);

  // Notify all added students
  const { data: drive } = await supabaseAdmin
    .from('placement_drives')
    .select('company_name, job_role, drive_date')
    .eq('id', req.params.id)
    .single();

  if (drive) {
    for (const sid of ids) {
      notify({
        userId: sid,
        type: 'placement_drive',
        title: `Drive: ${drive.company_name}`,
        message: `You are eligible for the ${drive.job_role} drive on ${new Date(drive.drive_date).toDateString()}. Register your interest now.`,
        entityType: 'drive',
        entityId: req.params.id,
        actionUrl: '/placement/drives',
      }).catch(() => {});
    }
  }

  return success(res, { added: data?.length || 0 }, 201);
});

/**
 * DELETE /api/drives/:id/eligible/:studentId
 */
router.delete('/:id/eligible/:studentId', authMiddleware, roleMiddleware(...MANAGE_ROLES), async (req, res) => {
  const { error: dbErr } = await supabaseAdmin
    .from('drive_eligible_students')
    .delete()
    .eq('drive_id', req.params.id)
    .eq('student_id', req.params.studentId);

  if (dbErr) return error(res, dbErr.message);
  return success(res, { removed: true });
});

/**
 * POST /api/drives/:id/register
 * Student registers interest in a drive.
 */
router.post('/:id/register', authMiddleware, async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('drive_eligible_students')
    .update({ registered: true })
    .eq('drive_id', req.params.id)
    .eq('student_id', req.user.id)
    .select()
    .single();

  if (dbErr) return error(res, dbErr.message);
  if (!data) return error(res, 'You are not eligible for this drive', 403);
  return success(res, data);
});

/* ─────────────────────────────────────────────────────────────
   SELECTION ROUNDS
───────────────────────────────────────────────────────────── */

/**
 * GET /api/drives/:id/rounds
 */
router.get('/:id/rounds', authMiddleware, async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('drive_selection_rounds')
    .select('*, drive_round_results(count)')
    .eq('drive_id', req.params.id)
    .order('round_number');

  if (dbErr) return error(res, dbErr.message);
  return success(res, data || []);
});

/**
 * POST /api/drives/:id/rounds
 * Add a selection round.
 */
router.post('/:id/rounds', authMiddleware, roleMiddleware(...MANAGE_ROLES), async (req, res) => {
  const { round_number, round_name, round_date, venue, notes } = req.body;
  if (!round_name) return error(res, 'round_name is required');

  // Auto-determine round_number if not provided
  let rn = round_number;
  if (!rn) {
    const { data: existing } = await supabaseAdmin
      .from('drive_selection_rounds')
      .select('round_number')
      .eq('drive_id', req.params.id)
      .order('round_number', { ascending: false })
      .limit(1);
    rn = (existing?.[0]?.round_number || 0) + 1;
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('drive_selection_rounds')
    .insert({
      drive_id: req.params.id,
      round_number: rn,
      round_name,
      round_date: round_date || null,
      venue: venue || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (dbErr) return error(res, dbErr.message);
  return success(res, data, 201);
});

/* ─────────────────────────────────────────────────────────────
   ROUND RESULTS (shortlist / eliminate)
───────────────────────────────────────────────────────────── */

/**
 * GET /api/drives/:id/rounds/:roundId/results
 */
router.get('/:id/rounds/:roundId/results', authMiddleware, roleMiddleware(...MANAGE_ROLES, 'teacher'), async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('drive_round_results')
    .select(`
      *,
      student:profiles!student_id(id, display_name, username, enrollment_number, hall_ticket_number)
    `)
    .eq('drive_id', req.params.id)
    .eq('round_id', req.params.roundId);

  if (dbErr) return error(res, dbErr.message);
  return success(res, data || []);
});

/**
 * POST /api/drives/:id/rounds/:roundId/results
 * Bulk upsert round results. Body: { results: [{ student_id, status, score, notes }] }
 */
router.post('/:id/rounds/:roundId/results', authMiddleware, roleMiddleware(...MANAGE_ROLES), async (req, res) => {
  const { results } = req.body;
  if (!Array.isArray(results) || results.length === 0) {
    return error(res, 'results[] is required');
  }

  const rows = results.map(r => ({
    drive_id: req.params.id,
    round_id: req.params.roundId,
    student_id: r.student_id,
    status: r.status || 'appeared',
    score: r.score ?? null,
    notes: r.notes || null,
    updated_at: new Date().toISOString(),
  }));

  const { data, error: dbErr } = await supabaseAdmin
    .from('drive_round_results')
    .upsert(rows, { onConflict: 'round_id,student_id' })
    .select();

  if (dbErr) return error(res, dbErr.message);

  // Notify shortlisted students
  const shortlisted = results.filter(r => r.status === 'shortlisted');
  for (const r of shortlisted) {
    notify({
      userId: r.student_id,
      type: 'placement_drive',
      title: 'You are shortlisted! 🎉',
      message: 'Congratulations! You have been shortlisted for the next round. Check your drive status.',
      entityType: 'drive',
      entityId: req.params.id,
      actionUrl: '/placement/drives',
    }).catch(() => {});
  }

  return success(res, { updated: data?.length || 0 });
});

/* ─────────────────────────────────────────────────────────────
   OFFER LETTERS
───────────────────────────────────────────────────────────── */

/**
 * GET /api/drives/:id/offers
 */
router.get('/:id/offers', authMiddleware, roleMiddleware(...MANAGE_ROLES, 'teacher'), async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('drive_offers')
    .select(`
      *,
      student:profiles!student_id(id, display_name, username, enrollment_number, hall_ticket_number,
        college_id, branch_id, colleges(name), branches(name))
    `)
    .eq('drive_id', req.params.id)
    .order('created_at');

  if (dbErr) return error(res, dbErr.message);
  return success(res, data || []);
});

/**
 * POST /api/drives/:id/offers
 * Record offer letters. Body: { offers: [{ student_id, job_role, ctc, offer_date, joining_date, offer_type }] }
 */
router.post('/:id/offers', authMiddleware, roleMiddleware(...MANAGE_ROLES), async (req, res) => {
  const { offers } = req.body;
  if (!Array.isArray(offers) || offers.length === 0) {
    return error(res, 'offers[] is required');
  }

  const { data: drive } = await supabaseAdmin
    .from('placement_drives')
    .select('company_name, job_role')
    .eq('id', req.params.id)
    .single();

  const rows = offers.map(o => ({
    drive_id: req.params.id,
    student_id: o.student_id,
    job_role: o.job_role || drive?.job_role || null,
    ctc: o.ctc || null,
    offer_date: o.offer_date || new Date().toISOString().split('T')[0],
    joining_date: o.joining_date || null,
    offer_type: o.offer_type || 'full-time',
    status: 'offered',
    notes: o.notes || null,
  }));

  const { data, error: dbErr } = await supabaseAdmin
    .from('drive_offers')
    .upsert(rows, { onConflict: 'drive_id,student_id' })
    .select();

  if (dbErr) return error(res, dbErr.message);

  // Notify each offered student
  for (const o of offers) {
    notify({
      userId: o.student_id,
      type: 'placement_drive',
      title: `Offer Letter — ${drive?.company_name || 'Company'} 🎉`,
      message: `You have received a job offer${o.ctc ? ` with a CTC of ₹${o.ctc} LPA` : ''}. Congratulations!`,
      entityType: 'drive',
      entityId: req.params.id,
      actionUrl: '/placement/drives',
    }).catch(() => {});
  }

  return success(res, { recorded: data?.length || 0 }, 201);
});

/**
 * PATCH /api/drives/:driveId/offers/:offerId
 * Update offer status (accepted / declined / revoked).
 */
router.patch('/:driveId/offers/:offerId', authMiddleware, async (req, res) => {
  const { status, notes } = req.body;
  const allowed = ['offered', 'accepted', 'declined', 'revoked'];
  if (!status || !allowed.includes(status)) {
    return error(res, `status must be one of ${allowed.join(', ')}`);
  }

  // Students can only accept/decline their own offer; admins/tpo can do anything
  const query = supabaseAdmin
    .from('drive_offers')
    .update({ status, notes: notes || null })
    .eq('id', req.params.offerId)
    .eq('drive_id', req.params.driveId);

  if (req.user.role === 'student') {
    query.eq('student_id', req.user.id);
  }

  const { data, error: dbErr } = await query.select().single();
  if (dbErr) return error(res, dbErr.message);
  return success(res, data);
});

/* ─────────────────────────────────────────────────────────────
   STUDENT — MY DRIVES (student-facing summary)
───────────────────────────────────────────────────────────── */

/**
 * GET /api/drives/my/summary
 * Student's full placement summary: eligible drives, round results, offers.
 */
router.get('/my/summary', authMiddleware, async (req, res) => {
  const [eligibleRes, offersRes] = await Promise.all([
    supabaseAdmin
      .from('drive_eligible_students')
      .select('drive_id, registered, placement_drives(company_name, job_role, drive_date, status, ctc_min, ctc_max)')
      .eq('student_id', req.user.id),
    supabaseAdmin
      .from('drive_offers')
      .select('*, placement_drives(company_name, job_role, drive_date)')
      .eq('student_id', req.user.id)
      .order('created_at', { ascending: false }),
  ]);

  return success(res, {
    eligible_drives: eligibleRes.data || [],
    offers: offersRes.data || [],
    offer_count: (offersRes.data || []).length,
    placed: (offersRes.data || []).some(o => o.status === 'accepted'),
  });
});

module.exports = router;
