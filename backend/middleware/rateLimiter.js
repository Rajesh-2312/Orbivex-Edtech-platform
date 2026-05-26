const rateLimit = require('express-rate-limit');

// Sized for ~150 concurrent students; campus NAT sends them all from one IP.
// Tunable via env so we can raise without redeploy.
const API_MAX = parseInt(process.env.RATE_LIMIT_API || '600', 10);
const AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH || '40', 10);
const AI_MAX = parseInt(process.env.RATE_LIMIT_AI || '30', 10);
const TUTOR_MAX = parseInt(process.env.RATE_LIMIT_TUTOR || '30', 10);

// Key AI/general routes by authenticated user when available so a single
// shared IP (campus NAT, school proxy) doesn't cause everyone to throttle
// each other. Falls back to IP for unauthenticated traffic.
const userOrIp = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return 'u:' + auth.slice(7, 39); // token prefix as a stable per-user bucket
  return 'ip:' + (req.ip || req.headers['x-forwarded-for'] || 'unknown');
};

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: API_MAX,
  keyGenerator: userOrIp,
  message: { success: false, error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth must stay IP-based — the whole point is to throttle credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: AUTH_MAX,
  message: { success: false, error: 'Too many authentication attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI is per-user — one user can't monopolize, but 100 users each doing 1 request/min works.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: AI_MAX,
  keyGenerator: userOrIp,
  message: { success: false, error: 'AI service rate limit reached for this user. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tutor RAG chat — separate budget from `aiLimiter` so admin question
// generation can't starve students, and vice-versa. Per-user.
const tutorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: TUTOR_MAX,
  keyGenerator: userOrIp,
  message: { success: false, error: 'Tutor rate limit reached. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter, aiLimiter, tutorLimiter };
