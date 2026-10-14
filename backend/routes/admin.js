const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { supabaseAdmin } = require('../config/supabase');
const { success, error } = require('../utils/response');
const { reindexLesson } = require('../utils/embedLesson');
const { notifySection, notifyByCourseAccess, notifyByScope } = require('../utils/notifications');

// All admin routes require auth + admin role
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

// ─── Dashboard Overview ───
router.get('/overview', async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: totalCourses },
      { count: totalLessons },
      { count: totalEnrollments },
      { count: totalJobs },
      { count: totalQuizResponses },
      { count: totalColleges },
      { count: totalEducators },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('courses').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('lessons').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('enrollments').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('quiz_responses').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('colleges').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('educators').select('*', { count: 'exact', head: true }),
    ]);

    // Recent signups (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentSignups } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo);

    return success(res, {
      totalUsers: totalUsers || 0,
      totalCourses: totalCourses || 0,
      totalLessons: totalLessons || 0,
      totalEnrollments: totalEnrollments || 0,
      totalJobs: totalJobs || 0,
      totalQuizResponses: totalQuizResponses || 0,
      totalColleges: totalColleges || 0,
      totalEducators: totalEducators || 0,
      recentSignups: recentSignups || 0,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── User Management ───
router.get('/users', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.put('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['student', 'teacher', 'admin'].includes(role)) {
    return error(res, 'Invalid role. Must be: student, teacher, or admin');
  }

  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return error(res, 'You cannot delete your own account');
  }

  try {
    // Delete from Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authErr) throw authErr;

    // Profile will be cleaned up by cascade/trigger
    return success(res, { message: 'User deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── Course Management ───
router.get('/courses', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/courses', async (req, res) => {
  const { title, description, category, difficulty, is_published } = req.body;

  if (!title) return error(res, 'Title is required');

  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('courses')
      .insert({
        title,
        description: description || '',
        category: category || 'general',
        difficulty: difficulty || 'beginner',
        is_published: is_published !== false,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.put('/courses/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, category, difficulty, is_published } = req.body;

  try {
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (is_published !== undefined) updates.is_published = is_published;
    updates.updated_at = new Date().toISOString();

    const { data, error: dbErr } = await supabaseAdmin
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/courses/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error: dbErr } = await supabaseAdmin
      .from('courses')
      .delete()
      .eq('id', id);

    if (dbErr) throw dbErr;
    return success(res, { message: 'Course deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── Lesson Management ───
router.get('/lessons', async (req, res) => {
  const { course_id } = req.query;
  try {
    let query = supabaseAdmin
      .from('lessons')
      .select('*, courses(title)')
      .order('created_at', { ascending: false });

    if (course_id) query = query.eq('course_id', course_id);

    const { data, error: dbErr } = await query;
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/lessons', async (req, res) => {
  const { course_id, title, description, video_url, content_text, sort_order, duration_minutes } = req.body;

  if (!course_id || !title) return error(res, 'course_id and title are required');

  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('lessons')
      .insert({
        course_id,
        title,
        description: description || '',
        video_url: video_url || null,
        content_text: content_text || '',
        sort_order: sort_order || 0,
        duration_minutes: duration_minutes || 0,
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    // Index the new lesson for the AI tutor (fire-and-forget).
    if (data?.id && data?.content_text) {
      reindexLesson(data.id).catch((err) => console.warn('[embed] reindex on lesson create failed:', err?.message));
    }

    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.put('/lessons/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, video_url, content_text, sort_order, duration_minutes } = req.body;

  try {
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (video_url !== undefined) updates.video_url = video_url;
    if (content_text !== undefined) updates.content_text = content_text;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;

    const { data, error: dbErr } = await supabaseAdmin
      .from('lessons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (dbErr) throw dbErr;

    // Re-index only when the lesson's text changed.
    if (Object.prototype.hasOwnProperty.call(updates, 'content_text')) {
      reindexLesson(id).catch((err) => console.warn('[embed] reindex on lesson update failed:', err?.message));
    }

    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/lessons/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // content_embeddings.source_id has no FK to lessons (it is polymorphic —
    // lesson OR question), so the lesson delete does not cascade to its chunks.
    // Remove them here, otherwise the deleted lesson's embeddings stay
    // searchable forever and surface as citations to a lesson that no longer
    // exists.
    await supabaseAdmin
      .from('content_embeddings')
      .delete()
      .eq('source_type', 'lesson')
      .eq('source_id', id);

    const { error: dbErr } = await supabaseAdmin.from('lessons').delete().eq('id', id);
    if (dbErr) throw dbErr;
    return success(res, { message: 'Lesson deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── Job Management ───
router.get('/jobs', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/jobs', async (req, res) => {
  const { title, company, description, location, type } = req.body;
  if (!title) return error(res, 'Title is required');

  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('jobs')
      .insert({
        title,
        company: company || '',
        description: description || '',
        location: location || '',
        type: type || 'full-time',
        posted_by: req.user.id,
      })
      .select()
      .single();

    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/jobs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error: dbErr } = await supabaseAdmin.from('jobs').delete().eq('id', id);
    if (dbErr) throw dbErr;
    return success(res, { message: 'Job deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ═══════════════════════════════════════════════════
// ─── College Management ───
// ═══════════════════════════════════════════════════

router.get('/colleges', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('colleges')
      .select('*')
      .order('created_at', { ascending: false });
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/colleges', async (req, res) => {
  const { name, code, address, city, state, pincode, type, established_year, principal_email, phone, website } = req.body;
  if (!name || !code || !type) return error(res, 'Name, code, and type are required');

  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('colleges')
      .insert({ name, code, address, city, state, pincode, type, established_year, principal_email, phone, website, created_by: req.user.id })
      .select()
      .single();
    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.patch('/colleges/:id', async (req, res) => {
  const { id } = req.params;
  const { name, code, address, city, state, pincode, type, established_year, principal_email, phone, website } = req.body;
  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (pincode !== undefined) updates.pincode = pincode;
    if (type !== undefined) updates.type = type;
    if (established_year !== undefined) updates.established_year = established_year;
    if (principal_email !== undefined) updates.principal_email = principal_email;
    if (phone !== undefined) updates.phone = phone;
    if (website !== undefined) updates.website = website;
    updates.updated_at = new Date().toISOString();

    const { data, error: dbErr } = await supabaseAdmin.from('colleges').update(updates).eq('id', id).select().single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/colleges/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Get test_paper ids for this college
    const { data: papers } = await supabaseAdmin
      .from('test_papers').select('id').eq('college_id', id);
    const paperIds = (papers || []).map((p) => p.id);

    // 2. Delete test_submissions for those papers (no cascade on test_paper_id)
    if (paperIds.length > 0) {
      await supabaseAdmin.from('test_submissions').delete().in('test_paper_id', paperIds);
      // test_paper_questions has ON DELETE CASCADE so they go with the paper
    }

    // 3. Delete test_papers (college_id NOT NULL — must delete, cannot nullify)
    await supabaseAdmin.from('test_papers').delete().eq('college_id', id);

    // 4. Nullify college_id on profiles (nullable FK)
    await supabaseAdmin.from('profiles')
      .update({ college_id: null, branch_id: null, section_id: null })
      .eq('college_id', id);

    // 5. Nullify college_id on educators (nullable FK)
    await supabaseAdmin.from('educators')
      .update({ college_id: null, branch_id: null })
      .eq('college_id', id);

    // 6. Nullify college_id on question_bank (nullable FK)
    await supabaseAdmin.from('question_bank')
      .update({ college_id: null })
      .eq('college_id', id);

    // 7. Delete the college — branches/sections cascade automatically
    //    (branches.college_id has ON DELETE CASCADE)
    const { error: dbErr } = await supabaseAdmin.from('colleges').delete().eq('id', id);
    if (dbErr) throw dbErr;

    return success(res, { message: 'College deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── Branches ───
router.get('/colleges/:id/branches', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('branches')
      .select('*, sections(*)')
      .eq('college_id', req.params.id)
      .order('created_at', { ascending: false });
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/colleges/:collegeId/branches', async (req, res) => {
  const { name, code, hod_name, hod_email } = req.body;
  if (!name || !code) return error(res, 'Name and code are required');
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('branches')
      .insert({ college_id: req.params.collegeId, name, code, hod_name, hod_email })
      .select()
      .single();
    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.patch('/branches/:id', async (req, res) => {
  const { name, code, hod_name, hod_email } = req.body;
  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (hod_name !== undefined) updates.hod_name = hod_name;
    if (hod_email !== undefined) updates.hod_email = hod_email;
    const { data, error: dbErr } = await supabaseAdmin.from('branches').update(updates).eq('id', req.params.id).select().single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/branches/:id', async (req, res) => {
  try {
    const { error: dbErr } = await supabaseAdmin.from('branches').delete().eq('id', req.params.id);
    if (dbErr) throw dbErr;
    return success(res, { message: 'Branch deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── Sections ───
router.post('/branches/:branchId/sections', async (req, res) => {
  const { section_name, academic_year, semester } = req.body;
  if (!section_name) return error(res, 'Section name is required');
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('sections')
      .insert({ branch_id: req.params.branchId, section_name, academic_year, semester })
      .select()
      .single();
    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.patch('/sections/:id', async (req, res) => {
  const { section_name, academic_year, semester, student_count } = req.body;
  try {
    const updates = {};
    if (section_name !== undefined) updates.section_name = section_name;
    if (academic_year !== undefined) updates.academic_year = academic_year;
    if (semester !== undefined) updates.semester = semester;
    if (student_count !== undefined) updates.student_count = student_count;
    const { data, error: dbErr } = await supabaseAdmin.from('sections').update(updates).eq('id', req.params.id).select().single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/sections/:id', async (req, res) => {
  try {
    const { error: dbErr } = await supabaseAdmin.from('sections').delete().eq('id', req.params.id);
    if (dbErr) throw dbErr;
    return success(res, { message: 'Section deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ═══════════════════════════════════════════════════
// ─── Student Management ───
// ═══════════════════════════════════════════════════

router.get('/students', async (req, res) => {
  const { college_id, branch_id, section_id, limit } = req.query;
  try {
    let query = supabaseAdmin
      .from('profiles')
      // colleges must be disambiguated: there are two FKs between profiles and
      // colleges (profiles.college_id → colleges.id, and colleges.created_by →
      // profiles.id), so a bare colleges(name) makes PostgREST reject the whole
      // query with PGRST201. branches and sections have only one FK each.
      .select('*, colleges!profiles_college_id_fkey(name), branches(name), sections(section_name)')
      .eq('role', 'student')
      .order('created_at', { ascending: false });

    if (college_id) query = query.eq('college_id', college_id);
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (section_id) query = query.eq('section_id', section_id);

    // Callers already pass ?limit=; honouring it keeps a 4,000-student college
    // from returning the entire table in one response.
    const max = Math.min(parseInt(limit, 10) || 500, 1000);
    query = query.limit(max);

    const { data, error: dbErr } = await query;
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.get('/students/:id', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      // Same two-FK ambiguity as GET /students above.
      .select('*, colleges!profiles_college_id_fkey(name), branches(name), sections(section_name)')
      .eq('id', req.params.id)
      .single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/students', async (req, res) => {
  const { email, password, display_name, college_id, branch_id, section_id, enrollment_number, hall_ticket_number, semester, admission_year, phone_number } = req.body;
  if (!email || !display_name) return error(res, 'Email and display name are required');

  try {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || 'Student@123',
      email_confirm: true,
      user_metadata: { display_name, username: email.split('@')[0] },
    });
    if (authErr) throw authErr;

    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .update({ college_id, branch_id, section_id, enrollment_number, hall_ticket_number, semester, admission_year, phone_number, display_name })
      .eq('id', authData.user.id)
      .select()
      .single();
    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/students/bulk-import', async (req, res) => {
  const { students, college_id } = req.body;
  if (!students || !Array.isArray(students) || students.length === 0) {
    return error(res, 'Students array is required');
  }

  const results = { successful: 0, failed: 0, errors: [] };

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: s.email,
        password: s.password || 'Student@123',
        email_confirm: true,
        user_metadata: { display_name: `${s.first_name} ${s.last_name}`, username: s.email.split('@')[0] },
      });
      if (authErr) throw authErr;

      // Look up branch and section by codes
      let branch_id = null;
      let section_id = null;
      if (s.branch_code && college_id) {
        const { data: branch } = await supabaseAdmin.from('branches').select('id').eq('college_id', college_id).eq('code', s.branch_code).single();
        if (branch) {
          branch_id = branch.id;
          if (s.section) {
            const { data: section } = await supabaseAdmin.from('sections').select('id').eq('branch_id', branch.id).eq('section_name', s.section).single();
            if (section) section_id = section.id;
          }
        }
      }

      await supabaseAdmin.from('profiles').update({
        college_id,
        branch_id,
        section_id,
        enrollment_number: s.enrollment_number,
        hall_ticket_number: s.hall_ticket_number,
        semester: s.semester ? parseInt(s.semester) : null,
        admission_year: s.admission_year ? parseInt(s.admission_year) : null,
        phone_number: s.phone,
        display_name: `${s.first_name} ${s.last_name}`,
      }).eq('id', authData.user.id);

      results.successful++;
    } catch (err) {
      results.failed++;
      results.errors.push({ row: i + 1, email: s.email, error: err.message });
    }
  }

  // Log the import
  await supabaseAdmin.from('bulk_imports').insert({
    import_type: 'students',
    college_id,
    imported_by: req.user.id,
    file_name: req.body.file_name || 'bulk-import',
    total_records: students.length,
    successful_records: results.successful,
    failed_records: results.failed,
    error_log: results.errors.length > 0 ? results.errors : null,
    import_status: 'completed',
    completed_at: new Date().toISOString(),
  });

  return success(res, results);
});

router.patch('/students/:id', async (req, res) => {
  const { display_name, college_id, branch_id, section_id, enrollment_number, hall_ticket_number, semester, admission_year, phone_number, is_active } = req.body;
  try {
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (college_id !== undefined) updates.college_id = college_id;
    if (branch_id !== undefined) updates.branch_id = branch_id;
    if (section_id !== undefined) updates.section_id = section_id;
    if (enrollment_number !== undefined) updates.enrollment_number = enrollment_number;
    if (hall_ticket_number !== undefined) updates.hall_ticket_number = hall_ticket_number;
    if (semester !== undefined) updates.semester = semester;
    if (admission_year !== undefined) updates.admission_year = admission_year;
    if (phone_number !== undefined) updates.phone_number = phone_number;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error: dbErr } = await supabaseAdmin.from('profiles').update(updates).eq('id', req.params.id).select().single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/students/:id', async (req, res) => {
  try {
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    if (authErr) throw authErr;
    return success(res, { message: 'Student deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/students/:id/activate', async (req, res) => {
  const { is_active } = req.body;
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: is_active !== false })
      .eq('id', req.params.id)
      .select()
      .single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── Bulk Import History ───
router.get('/bulk-imports', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('bulk_imports')
      .select('*')
      .order('created_at', { ascending: false });
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.get('/bulk-imports/:id', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin.from('bulk_imports').select('*').eq('id', req.params.id).single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ═══════════════════════════════════════════════════
// ─── Educator Management ───
// ═══════════════════════════════════════════════════

router.get('/educators', async (req, res) => {
  const { college_id, branch_id } = req.query;
  try {
    let query = supabaseAdmin
      .from('educators')
      .select('*, profiles(display_name, username, email), colleges(name), branches(name)')
      .order('created_at', { ascending: false });
    if (college_id) query = query.eq('college_id', college_id);
    if (branch_id) query = query.eq('branch_id', branch_id);
    const { data, error: dbErr } = await query;
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/educators', async (req, res) => {
  const { email, password, display_name, college_id, branch_id, section_id, qualification, specialization, experience_years } = req.body;
  if (!email || !display_name) return error(res, 'Email and display name are required');

  try {
    // Create auth user with teacher role
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || 'Teacher@123',
      email_confirm: true,
      user_metadata: { display_name, username: email.split('@')[0] },
    });
    if (authErr) throw authErr;

    // Set role to teacher
    await supabaseAdmin.from('profiles').update({ role: 'teacher' }).eq('id', authData.user.id);

    // Create educator record
    const { data, error: dbErr } = await supabaseAdmin
      .from('educators')
      .insert({ user_id: authData.user.id, college_id, branch_id, section_id, qualification, specialization, experience_years })
      .select('*, profiles(display_name, username)')
      .single();
    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.patch('/educators/:id', async (req, res) => {
  const { college_id, branch_id, section_id, qualification, specialization, experience_years, is_active } = req.body;
  try {
    const updates = {};
    if (college_id !== undefined) updates.college_id = college_id;
    if (branch_id !== undefined) updates.branch_id = branch_id;
    if (section_id !== undefined) updates.section_id = section_id;
    if (qualification !== undefined) updates.qualification = qualification;
    if (specialization !== undefined) updates.specialization = specialization;
    if (experience_years !== undefined) updates.experience_years = experience_years;
    if (is_active !== undefined) updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error: dbErr } = await supabaseAdmin.from('educators').update(updates).eq('id', req.params.id).select().single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/educators/:id', async (req, res) => {
  try {
    const { error: dbErr } = await supabaseAdmin.from('educators').delete().eq('id', req.params.id);
    if (dbErr) throw dbErr;
    return success(res, { message: 'Educator deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/educators/:id/assign-branch', async (req, res) => {
  const { branch_id, section_id } = req.body;
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('educators')
      .update({ branch_id, section_id, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/educators/:id/assign-course', async (req, res) => {
  const { course_id, section_id, academic_year } = req.body;
  if (!course_id) return error(res, 'Course ID is required');
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('educator_courses')
      .insert({ educator_id: req.params.id, course_id, section_id, academic_year })
      .select()
      .single();
    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/educators/:id/courses/:courseId', async (req, res) => {
  try {
    const { error: dbErr } = await supabaseAdmin
      .from('educator_courses')
      .delete()
      .eq('educator_id', req.params.id)
      .eq('course_id', req.params.courseId);
    if (dbErr) throw dbErr;
    return success(res, { message: 'Course removed from educator' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── Agent Config ───
router.get('/educators/:id/agent-config', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('educator_agent_config')
      .select('*')
      .eq('educator_id', req.params.id);
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/educators/:id/configure-agents', async (req, res) => {
  const { agent_type, model_name, agent_count, parameters } = req.body;
  if (!agent_type) return error(res, 'Agent type is required');
  try {
    // Upsert: update if exists, insert if not
    const { data: existing } = await supabaseAdmin
      .from('educator_agent_config')
      .select('id')
      .eq('educator_id', req.params.id)
      .eq('agent_type', agent_type)
      .single();

    let data;
    if (existing) {
      const { data: updated, error: dbErr } = await supabaseAdmin
        .from('educator_agent_config')
        .update({ model_name, agent_count: Math.min(Math.max(agent_count || 1, 1), 10), parameters, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (dbErr) throw dbErr;
      data = updated;
    } else {
      const { data: inserted, error: dbErr } = await supabaseAdmin
        .from('educator_agent_config')
        .insert({ educator_id: req.params.id, agent_type, model_name, agent_count: Math.min(Math.max(agent_count || 1, 1), 10), parameters })
        .select()
        .single();
      if (dbErr) throw dbErr;
      data = inserted;
    }
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ═══════════════════════════════════════════════════
// ─── Question Bank (with AI Generation) ───
// ═══════════════════════════════════════════════════

const quizAgent = require('../agents/quizAgent');

router.get('/question-bank', async (req, res) => {
  const { course_id, test_type, difficulty_level, question_type } = req.query;
  try {
    let query = supabaseAdmin
      .from('question_bank')
      .select('*, courses(title)')
      .order('created_at', { ascending: false });
    if (course_id) query = query.eq('course_id', course_id);
    if (test_type) query = query.eq('test_type', test_type);
    if (difficulty_level) query = query.eq('difficulty_level', difficulty_level);
    if (question_type) query = query.eq('question_type', question_type);
    const { data, error: dbErr } = await query;
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/question-bank', async (req, res) => {
  const { college_id, course_id, question_text, question_type, difficulty_level, category, test_type, company_name, answers_json } = req.body;
  if (!question_text || !question_type || !test_type) return error(res, 'Question text, type, and test type are required');
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('question_bank')
      .insert({ college_id, course_id, question_text, question_type, difficulty_level, category, test_type, company_name, answers_json })
      .select()
      .single();
    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.patch('/question-bank/:id', async (req, res) => {
  const { question_text, question_type, difficulty_level, category, test_type, company_name, answers_json } = req.body;
  try {
    const updates = {};
    if (question_text !== undefined) updates.question_text = question_text;
    if (question_type !== undefined) updates.question_type = question_type;
    if (difficulty_level !== undefined) updates.difficulty_level = difficulty_level;
    if (category !== undefined) updates.category = category;
    if (test_type !== undefined) updates.test_type = test_type;
    if (company_name !== undefined) updates.company_name = company_name;
    if (answers_json !== undefined) updates.answers_json = answers_json;
    updates.updated_at = new Date().toISOString();

    const { data, error: dbErr } = await supabaseAdmin.from('question_bank').update(updates).eq('id', req.params.id).select().single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/question-bank/:id', async (req, res) => {
  try {
    const { error: dbErr } = await supabaseAdmin.from('question_bank').delete().eq('id', req.params.id);
    if (dbErr) throw dbErr;
    return success(res, { message: 'Question deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/question-bank/bulk-import', async (req, res) => {
  const { questions, college_id } = req.body;
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return error(res, 'Questions array is required');
  }
  try {
    const rows = questions.map((q) => ({
      college_id,
      course_id: q.course_id || null,
      question_text: q.question_text,
      question_type: q.question_type || 'mcq',
      difficulty_level: q.difficulty_level || 'medium',
      category: q.category || 'technical',
      test_type: q.test_type || 'academic',
      company_name: q.company_name || null,
      answers_json: q.answers_json || null,
    }));

    const { data, error: dbErr } = await supabaseAdmin.from('question_bank').insert(rows).select();
    if (dbErr) throw dbErr;
    return success(res, { imported: data.length });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── AI Question Generation ───
router.post('/question-bank/generate', async (req, res) => {
  const { course_id, college_id, content, num_questions, difficulty_level, category, test_type, company_name } = req.body;

  if (!content || !num_questions) return error(res, 'Content and num_questions are required');
  if (num_questions < 1 || num_questions > 50) return error(res, 'num_questions must be between 1 and 50');

  try {
    // Generate questions via AI
    const generated = await quizAgent.generate(content, num_questions);

    if (!Array.isArray(generated) || generated.length === 0) {
      return error(res, 'AI failed to generate valid questions. Try again.', 500);
    }

    // Transform AI output into question_bank format and save
    const rows = generated.map((q) => ({
      college_id: college_id || null,
      course_id: course_id || null,
      question_text: q.question || q.question_text || '',
      question_type: 'mcq',
      difficulty_level: difficulty_level || 'medium',
      category: category || 'technical',
      test_type: test_type || 'academic',
      company_name: company_name || null,
      answers_json: {
        options: q.options || [],
        correct: typeof q.correct_answer === 'string'
          ? ['A', 'B', 'C', 'D'].indexOf(q.correct_answer.charAt(0).toUpperCase())
          : (q.correct ?? 0),
        explanation: q.explanation || '',
      },
    }));

    // Filter out any with empty question_text
    const validRows = rows.filter((r) => r.question_text.trim().length > 0);

    if (validRows.length === 0) {
      return error(res, 'AI generated questions but none were valid. Try with different content.', 500);
    }

    const { data, error: dbErr } = await supabaseAdmin.from('question_bank').insert(validRows).select();
    if (dbErr) throw dbErr;

    return success(res, {
      generated: generated.length,
      saved: data.length,
      questions: data,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── Generate from Lesson Content ───
router.post('/question-bank/generate-from-lesson', async (req, res) => {
  const { lesson_id, college_id, num_questions, difficulty_level, category, test_type, company_name } = req.body;

  if (!lesson_id || !num_questions) return error(res, 'lesson_id and num_questions are required');

  try {
    // Fetch lesson content
    const { data: lesson, error: lessonErr } = await supabaseAdmin
      .from('lessons')
      .select('title, content_text, courses(id, title)')
      .eq('id', lesson_id)
      .single();

    if (lessonErr || !lesson) return error(res, 'Lesson not found', 404);
    if (!lesson.content_text || lesson.content_text.trim().length < 50) {
      return error(res, 'Lesson has insufficient content for question generation (min 50 chars)');
    }

    // Generate via AI
    const generated = await quizAgent.generate(lesson.content_text, num_questions);

    if (!Array.isArray(generated) || generated.length === 0) {
      return error(res, 'AI failed to generate valid questions. Try again.', 500);
    }

    const rows = generated.map((q) => ({
      college_id: college_id || null,
      course_id: lesson.courses?.id || null,
      question_text: q.question || q.question_text || '',
      question_type: 'mcq',
      difficulty_level: difficulty_level || 'medium',
      category: category || 'technical',
      test_type: test_type || 'academic',
      company_name: company_name || null,
      answers_json: {
        options: q.options || [],
        correct: typeof q.correct_answer === 'string'
          ? ['A', 'B', 'C', 'D'].indexOf(q.correct_answer.charAt(0).toUpperCase())
          : (q.correct ?? 0),
        explanation: q.explanation || '',
      },
    }));

    const validRows = rows.filter((r) => r.question_text.trim().length > 0);

    if (validRows.length === 0) {
      return error(res, 'AI generated questions but none were valid.', 500);
    }

    const { data, error: dbErr } = await supabaseAdmin.from('question_bank').insert(validRows).select();
    if (dbErr) throw dbErr;

    return success(res, {
      lesson_title: lesson.title,
      course_title: lesson.courses?.title,
      generated: generated.length,
      saved: data.length,
      questions: data,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ═══════════════════════════════════════════════════
// ─── Test Papers ───
// ═══════════════════════════════════════════════════

router.get('/test-papers', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('test_papers')
      .select('*, colleges(name), courses(title)')
      .order('created_at', { ascending: false });
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/test-papers', async (req, res) => {
  const { college_id, branch_id, section_id, course_id, title, description, test_type, company_name, total_marks, duration_minutes, passing_score, scheduled_date, scheduled_end_time } = req.body;
  if (!college_id || !title || !test_type) return error(res, 'College, title, and test type are required');
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('test_papers')
      .insert({ college_id, branch_id, section_id, course_id, title, description, test_type, company_name, total_marks, duration_minutes, passing_score, scheduled_date, scheduled_end_time })
      .select()
      .single();
    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.patch('/test-papers/:id', async (req, res) => {
  const { title, description, test_type, company_name, total_marks, duration_minutes, passing_score, scheduled_date, scheduled_end_time, status } = req.body;
  try {
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (test_type !== undefined) updates.test_type = test_type;
    if (company_name !== undefined) updates.company_name = company_name;
    if (total_marks !== undefined) updates.total_marks = total_marks;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (passing_score !== undefined) updates.passing_score = passing_score;
    if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date;
    if (scheduled_end_time !== undefined) updates.scheduled_end_time = scheduled_end_time;
    if (status !== undefined) updates.status = status;
    updates.updated_at = new Date().toISOString();

    const { data, error: dbErr } = await supabaseAdmin.from('test_papers').update(updates).eq('id', req.params.id).select().single();
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/test-papers/:id/publish', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('test_papers')
      .update({ is_published: true, status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (dbErr) throw dbErr;

    // Side effects: calendar mirror + per-student notifications. Don't block
    // the response on these — failures here shouldn't fail the publish.
    (async () => {
      try {
        // Mirror into calendar_events so the calendar has a single source of truth.
        if (data.scheduled_date) {
          await supabaseAdmin.from('calendar_events').insert({
            college_id: data.college_id || null,
            branch_id: data.branch_id || null,
            section_id: data.section_id || null,
            test_paper_id: data.id,
            title: data.title || 'Scheduled test',
            description: data.description || null,
            type: 'exam',
            starts_at: data.scheduled_date,
            ends_at: data.scheduled_end_time || null,
            created_by: req.user.id,
          });
        }

        // Notify students in scope. Section is the tightest scope; fall back
        // to branch / college if section is null.
        const payload = {
          type: 'test_published',
          title: 'New test scheduled',
          message: `${data.title || 'A new test'} has been scheduled${data.scheduled_date ? ' for ' + new Date(data.scheduled_date).toLocaleString() : ''}.`,
          entityType: 'test_paper',
          entityId: data.id,
          actionUrl: `/tests/${data.id}`,
        };
        if (data.section_id) {
          await notifySection({ sectionId: data.section_id, ...payload });
        } else {
          await notifyByScope({
            collegeId: data.college_id || null,
            branchId: data.branch_id || null,
            ...payload,
          });
        }
      } catch (err) {
        console.warn('[publish] side effects failed:', err?.message);
      }
    })();

    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/test-papers/:id', async (req, res) => {
  try {
    const { error: dbErr } = await supabaseAdmin.from('test_papers').delete().eq('id', req.params.id);
    if (dbErr) throw dbErr;
    return success(res, { message: 'Test paper deleted' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.post('/test-papers/:id/add-questions', async (req, res) => {
  const { questions } = req.body; // [{question_id, marks, sort_order}]
  if (!questions || !Array.isArray(questions)) return error(res, 'Questions array is required');
  try {
    const rows = questions.map((q) => ({
      test_paper_id: req.params.id,
      question_id: q.question_id,
      marks: q.marks || 1,
      sort_order: q.sort_order || 0,
    }));
    const { data, error: dbErr } = await supabaseAdmin.from('test_paper_questions').insert(rows).select();
    if (dbErr) throw dbErr;
    return success(res, data, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.delete('/test-papers/:testId/questions/:questionId', async (req, res) => {
  try {
    const { error: dbErr } = await supabaseAdmin
      .from('test_paper_questions')
      .delete()
      .eq('test_paper_id', req.params.testId)
      .eq('question_id', req.params.questionId);
    if (dbErr) throw dbErr;
    return success(res, { message: 'Question removed from test' });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

router.get('/test-papers/:id/results', async (req, res) => {
  try {
    const { data, error: dbErr } = await supabaseAdmin
      .from('test_submissions')
      .select('*, profiles(display_name, enrollment_number)')
      .eq('test_paper_id', req.params.id)
      .order('obtained_marks', { ascending: false });
    if (dbErr) throw dbErr;
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ─── Course Access (gate courses by college/branch/section) ───
router.get('/courses/:id/access', async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('course_access')
    .select('*, colleges(name), branches(name), sections(section_name)')
    .eq('course_id', req.params.id);
  if (dbErr) return error(res, dbErr.message);
  return success(res, data);
});

router.post('/courses/:id/access', async (req, res) => {
  const { college_id, branch_id, section_id } = req.body;
  if (!college_id && !branch_id && !section_id) {
    return error(res, 'At least one of college_id, branch_id, section_id is required');
  }
  const { data, error: dbErr } = await supabaseAdmin
    .from('course_access')
    .insert({ course_id: req.params.id, college_id, branch_id, section_id })
    .select()
    .single();
  if (dbErr) return error(res, dbErr.message);

  // Notify all students who fall under this new scope.
  (async () => {
    try {
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('title')
        .eq('id', req.params.id)
        .single();
      await notifyByScope({
        collegeId: college_id || null,
        branchId: branch_id || null,
        sectionId: section_id || null,
        type: 'course_access',
        title: 'New course available',
        message: `${course?.title || 'A new course'} is now available to you.`,
        entityType: 'course',
        entityId: req.params.id,
        actionUrl: `/courses/${req.params.id}`,
      });
    } catch (err) {
      console.warn('[course-access] notify failed:', err?.message);
    }
  })();

  return success(res, data, 201);
});

router.delete('/courses/:id/access/:accessId', async (req, res) => {
  const { error: dbErr } = await supabaseAdmin
    .from('course_access')
    .delete()
    .eq('id', req.params.accessId)
    .eq('course_id', req.params.id);
  if (dbErr) return error(res, dbErr.message);
  return success(res, { message: 'Access entry removed' });
});

// ─── Generate Course from Subject (AI) ───
router.post('/courses/generate', async (req, res) => {
  const courseGeneratorAgent = require('../agents/courseGeneratorAgent');
  const { subject, difficulty, num_lessons, audience, publish, access } = req.body;
  if (!subject) return error(res, 'subject is required');

  try {
    const outline = await courseGeneratorAgent.generate(subject, {
      difficulty,
      numLessons: num_lessons,
      audience,
    });

    const { data: course, error: courseErr } = await supabaseAdmin
      .from('courses')
      .insert({
        title: outline.title,
        description: outline.description || '',
        category: outline.category || 'general',
        difficulty: outline.difficulty || difficulty || 'beginner',
        created_by: req.user.id,
        is_published: !!publish,
      })
      .select()
      .single();
    if (courseErr) throw courseErr;

    const lessonRows = (outline.lessons || []).map((l, i) => ({
      course_id: course.id,
      title: l.title,
      description: l.description || '',
      content_text: l.content_text || '',
      sort_order: i + 1,
      duration_minutes: l.duration_minutes || 15,
    }));

    let lessons = [];
    if (lessonRows.length) {
      const { data, error: lErr } = await supabaseAdmin.from('lessons').insert(lessonRows).select();
      if (lErr) throw lErr;
      lessons = data;

      // Index each generated lesson for the AI tutor. Fire-and-forget.
      for (const l of lessons) {
        if (l?.id && l?.content_text) {
          reindexLesson(l.id).catch((err) =>
            console.warn('[embed] reindex on course-generate failed:', l.id, err?.message)
          );
        }
      }
    }

    // Optional: attach access scopes in the same call
    if (Array.isArray(access) && access.length) {
      const accessRows = access.map((a) => ({
        course_id: course.id,
        college_id: a.college_id || null,
        branch_id: a.branch_id || null,
        section_id: a.section_id || null,
      }));
      await supabaseAdmin.from('course_access').insert(accessRows);

      // Notify students under each scope. Aggregate so we don't fan out
      // multiple notifications when scopes overlap.
      if (publish) {
        (async () => {
          try {
            await notifyByCourseAccess(course.id, null, {
              type: 'course_access',
              title: 'New course available',
              message: `${course.title} is now available to you.`,
              entityType: 'course',
              entityId: course.id,
              actionUrl: `/courses/${course.id}`,
            });
          } catch (err) {
            console.warn('[course-generate] notify failed:', err?.message);
          }
        })();
      }
    }

    return success(res, { course, lessons });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

module.exports = router;
