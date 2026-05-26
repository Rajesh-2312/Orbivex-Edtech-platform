const { supabaseAdmin } = require('../config/supabase');
const { sendEmail } = require('./email');
const { pickTemplate } = require('./emailTemplates');

async function maybeEmail(userId, payload) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, notify_email_optin')
      .eq('id', userId)
      .single();
    if (!profile || profile.notify_email_optin === false) return;

    const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userRow?.user?.email;
    if (!email) return;

    const tmpl = pickTemplate(payload.type)(payload);
    await sendEmail({ to: email, subject: tmpl.subject, html: tmpl.html });
  } catch (err) {
    console.warn('[notify] email dispatch failed:', err?.message || err);
  }
}

/**
 * Insert a notification row for a single user and fire-and-forget the email.
 * Never throws — notification side-effects must not break the caller's flow.
 */
async function notify(payload) {
  const { userId, type, title, message, entityType, entityId, actionUrl } = payload || {};
  if (!userId || !title) return { skipped: true, reason: 'missing_fields' };

  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type: type || null,
        title,
        message: message || null,
        entity_type: entityType || null,
        entity_id: entityId || null,
        action_url: actionUrl || null,
        read: false,
      })
      .select()
      .single();

    if (dbErr) {
      console.warn('[notify] insert failed:', dbErr.message);
      return { skipped: false, ok: false, error: dbErr.message };
    }

    // Fire-and-forget email; do not await before returning the row.
    maybeEmail(userId, payload).catch((e) => console.warn('[notify] email error', e?.message));

    return { skipped: false, ok: true, id: data.id };
  } catch (err) {
    console.warn('[notify] unexpected error:', err?.message || err);
    return { skipped: false, ok: false, error: err?.message };
  }
}

/**
 * Fan-out: insert one row per student in a section. Required so the per-user
 * Realtime filter `user_id=eq.<id>` fires for each recipient.
 */
async function notifySection({ sectionId, ...payload }) {
  if (!sectionId) return notifyByScope({ ...payload });
  try {
    const { data: students } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('section_id', sectionId)
      .eq('role', 'student');
    const userIds = (students || []).map((s) => s.id);
    return await fanout(userIds, payload);
  } catch (err) {
    console.warn('[notifySection] failed:', err?.message);
    return { ok: false };
  }
}

/**
 * Notify every student matching a wildcarded scope. Pass `null` for any of
 * collegeId/branchId/sectionId to match any value at that level.
 */
async function notifyByScope({ collegeId, branchId, sectionId, ...payload }) {
  try {
    let q = supabaseAdmin.from('profiles').select('id').eq('role', 'student');
    if (collegeId) q = q.eq('college_id', collegeId);
    if (branchId)  q = q.eq('branch_id', branchId);
    if (sectionId) q = q.eq('section_id', sectionId);
    const { data: students } = await q;
    return await fanout((students || []).map((s) => s.id), payload);
  } catch (err) {
    console.warn('[notifyByScope] failed:', err?.message);
    return { ok: false };
  }
}

/**
 * Notify every student whose profile matches at least one access row of a
 * course. Mirrors the `filterByCourseAccess` rule used to gate /api/courses.
 * If the course has zero access rows OR the scope is supplied directly, the
 * scope-based fan-out is used (single-row "public" notifications would still
 * need per-user delivery for Realtime to fire).
 */
async function notifyByCourseAccess(courseId, scopeOverride, payload) {
  try {
    // Direct scope wins if provided.
    if (scopeOverride && (scopeOverride.collegeId || scopeOverride.branchId || scopeOverride.sectionId)) {
      return await notifyByScope({ ...scopeOverride, ...payload });
    }

    // Pull access rows for this course.
    const { data: accessRows } = await supabaseAdmin
      .from('course_access')
      .select('college_id, branch_id, section_id')
      .eq('course_id', courseId);

    if (!accessRows || accessRows.length === 0) {
      // Public course — skip fan-out by default (avoid notifying every student
      // on the platform). Callers can pass an explicit scope to override.
      return { skipped: true, reason: 'public_course' };
    }

    const seen = new Set();
    for (const row of accessRows) {
      let q = supabaseAdmin.from('profiles').select('id').eq('role', 'student');
      if (row.college_id) q = q.eq('college_id', row.college_id);
      if (row.branch_id)  q = q.eq('branch_id', row.branch_id);
      if (row.section_id) q = q.eq('section_id', row.section_id);
      const { data: students } = await q;
      (students || []).forEach((s) => seen.add(s.id));
    }
    return await fanout([...seen], payload);
  } catch (err) {
    console.warn('[notifyByCourseAccess] failed:', err?.message);
    return { ok: false };
  }
}

async function fanout(userIds, payload) {
  const ids = Array.from(new Set(userIds || []));
  if (!ids.length) return { ok: true, count: 0 };

  // Bulk insert rows for Realtime to broadcast.
  const rows = ids.map((uid) => ({
    user_id: uid,
    type: payload.type || null,
    title: payload.title,
    message: payload.message || null,
    entity_type: payload.entityType || null,
    entity_id: payload.entityId || null,
    action_url: payload.actionUrl || null,
    read: false,
  }));

  const { error: dbErr } = await supabaseAdmin.from('notifications').insert(rows);
  if (dbErr) {
    console.warn('[fanout] insert failed:', dbErr.message);
    return { ok: false, error: dbErr.message };
  }

  // Fire-and-forget per-user emails (capped concurrency via Promise.all
  // over modest batches; Resend free tier handles this fine).
  for (let i = 0; i < ids.length; i += 16) {
    Promise.all(ids.slice(i, i + 16).map((uid) => maybeEmail(uid, payload)))
      .catch((e) => console.warn('[fanout] email batch failed', e?.message));
  }

  return { ok: true, count: ids.length };
}

module.exports = { notify, notifySection, notifyByScope, notifyByCourseAccess };
