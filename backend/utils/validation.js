/**
 * Input validation helpers.
 */

function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Username is required';
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 30) return 'Username must be at most 30 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password.length > 128) return 'Password is too long';
  return null;
}

function validateDisplayName(name) {
  if (!name || typeof name !== 'string') return 'Display name is required';
  if (name.trim().length < 2) return 'Display name must be at least 2 characters';
  if (name.length > 50) return 'Display name must be at most 50 characters';
  return null;
}

function validateRequired(fields, body) {
  const missing = fields.filter((f) => !body[f]);
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

module.exports = { validateUsername, validatePassword, validateDisplayName, validateRequired };
