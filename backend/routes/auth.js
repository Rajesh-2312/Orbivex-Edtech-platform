const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const { validatePassword, validateDisplayName } = require('../utils/validation');
const { success, error } = require('../utils/response');

/**
 * POST /api/auth/signup
 * Create a new account with email + password.
 */
router.post('/signup', async (req, res) => {
  const { email, password, display_name } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return error(res, 'A valid email is required');
  }

  const passwordErr = validatePassword(password);
  if (passwordErr) return error(res, passwordErr);

  const nameErr = validateDisplayName(display_name);
  if (nameErr) return error(res, nameErr);

  // Sign up via Supabase Auth using the admin client to bypass email confirmation
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      display_name,
    },
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      return error(res, 'An account with this email already exists');
    }
    return error(res, authError.message);
  }

  // Sign in immediately to get a session token
  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  if (sessionError) {
    return error(res, 'Account created but login failed. Please try logging in.');
  }

  return success(res, {
    token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    user: {
      id: authData.user.id,
      email: email.toLowerCase(),
      display_name,
      role: 'student',
    },
  }, 201);
});

/**
 * POST /api/auth/login
 * Log in with email + password.
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return error(res, 'Email and password are required');
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  if (authError) {
    return error(res, 'Invalid email or password', 401);
  }

  // Fetch profile using admin client to bypass RLS
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.error('[login] Profile fetch error:', profileError.message);
  }

  return success(res, {
    token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    user: {
      id: authData.user.id,
      email: authData.user.email,
      display_name: profile?.display_name || authData.user.user_metadata?.display_name || '',
      role: profile?.role || 'student',
      avatar_url: profile?.avatar_url || null,
      enrollment_number: profile?.enrollment_number || null,
    },
  });
});

/**
 * POST /api/auth/logout
 * End the current session.
 */
router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    // Revoke the specific user session via the admin API
    const { data } = await supabase.auth.getUser(token).catch(() => ({}));
    if (data?.user?.id) {
      await supabaseAdmin.auth.admin.signOut(token).catch(() => {});
    }
  }
  return success(res, { message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Get current user profile.
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Not authenticated', 401);
    }

    const token = authHeader.split(' ')[1];
    const { data, error: authError } = await supabase.auth.getUser(token);

    if (authError || !data.user) {
      return error(res, 'Invalid or expired token', 401);
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, role, avatar_url, bio, enrollment_number, notify_email_optin, college_id, branch_id, section_id, created_at')
      .eq('id', data.user.id)
      .single();

    return success(res, {
      id: data.user.id,
      email: data.user.email,
      display_name: profile?.display_name || data.user.user_metadata?.display_name,
      role: profile?.role || 'student',
      avatar_url: profile?.avatar_url,
      bio: profile?.bio,
      enrollment_number: profile?.enrollment_number,
      notify_email_optin: profile?.notify_email_optin !== false,
      college_id: profile?.college_id,
      branch_id: profile?.branch_id,
      section_id: profile?.section_id,
      created_at: profile?.created_at,
    });
  } catch (err) {
    return error(res, 'Failed to fetch user profile', 500);
  }
});

/**
 * PATCH /api/auth/profile
 * Update display_name and/or bio for the authenticated user.
 */
const authMiddleware = require('../middleware/auth');

router.patch('/profile', authMiddleware, async (req, res) => {
  const { display_name, bio, enrollment_number, notify_email_optin } = req.body;
  const userId = req.user.id;

  const updates = {};
  if (display_name !== undefined) updates.display_name = display_name.trim();
  if (bio !== undefined) updates.bio = bio.trim();
  if (enrollment_number !== undefined) updates.enrollment_number = enrollment_number.trim() || null;
  if (notify_email_optin !== undefined) updates.notify_email_optin = !!notify_email_optin;

  if (Object.keys(updates).length === 0) {
    return error(res, 'Nothing to update');
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (dbError) {
    if (dbError.message.includes('unique constraint') || dbError.code === '23505') {
      return error(res, 'This Roll / Enrollment Number is already in use.');
    }
    return error(res, dbError.message);
  }

  return success(res, {
    id: data.id,
    display_name: data.display_name,
    bio: data.bio,
    role: data.role,
    avatar_url: data.avatar_url,
    enrollment_number: data.enrollment_number,
    notify_email_optin: data.notify_email_optin,
  });
});

/**
 * POST /api/auth/onboard-college
 * Self-service college + admin account creation (called from OnboardingPage)
 */
router.post('/onboard-college', async (req, res) => {
  const { college, admin_name, admin_email, admin_password } = req.body;

  if (!college?.name || !admin_email || !admin_password || !admin_name) {
    return error(res, 'All fields required: college and admin details');
  }

  const passwordErr = validatePassword(admin_password);
  if (passwordErr) return error(res, passwordErr);

  try {
    // 1. Create college record
    const { data: newCollege, error: colErr } = await supabaseAdmin
      .from('colleges')
      .insert({
        name: college.name.trim(),
        code: college.code?.trim() || college.name.substring(0, 6).toUpperCase(),
        type: college.type || 'Engineering',
        address: [college.city, college.state].filter(Boolean).join(', '),
        principal_email: college.principal_email?.trim() || admin_email,
        phone: college.phone?.trim() || null,
      })
      .select()
      .single();

    if (colErr) {
      console.error('[onboard] College creation error:', colErr);
      return error(res, 'Failed to create college record');
    }

    // 2. Create admin user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email.toLowerCase().trim(),
      password: admin_password,
      email_confirm: true,
      user_metadata: { display_name: admin_name, role: 'admin' },
    });

    if (authErr) {
      // Rollback college if user creation fails
      await supabaseAdmin.from('colleges').delete().eq('id', newCollege.id);
      if (authErr.message.includes('already been registered')) {
        return error(res, 'An account with this email already exists');
      }
      return error(res, authErr.message);
    }

    // 3. Set admin profile with college link
    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        display_name: admin_name.trim(),
        role: 'admin',
        college_id: newCollege.id,
      }, { onConflict: 'id' });

    return success(res, {
      message: 'College and admin account created successfully.',
      college_id: newCollege.id,
      admin_email,
    }, 201);
  } catch (err) {
    console.error('[onboard] Unexpected error:', err);
    return error(res, 'Onboarding failed. Please contact support.');
  }
});

module.exports = router;
