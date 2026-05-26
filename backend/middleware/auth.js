const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Authentication middleware — verifies the Supabase JWT token
 * from the Authorization header and attaches user to req.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch profile for username and role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    req.user = {
      id: data.user.id,
      username: profile?.username || 'unknown',
      display_name: profile?.display_name || 'User',
      role: profile?.role || 'student',
      avatar_url: profile?.avatar_url || null,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = authMiddleware;
