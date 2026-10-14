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
//
// This used to key on `auth.slice(7, 39)` — the first 32 characters of the JWT.
// Those characters are the base64url-encoded *header* (`{"alg":"HS256",...}`),
// which is byte-identical for every token Supabase issues for the project. So
// every authenticated user shared one bucket: AI_MAX=30/min was a global cap
// across all students, and one user could lock out a whole campus.
//
// The real user id is the `sub` claim. These limiters run before
// authMiddleware, so the signature is not verified here — that is fine and
// deliberate: a forged `sub` can only move a request into a *different* rate
// bucket, and the request still has to pass real JWT verification downstream to
// do anything. Nothing is authorized on the strength of this value.
const userBucket = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const payload = auth.slice(7).split('.')[1];
    if (payload) {
      try {
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (claims?.sub) return 'u:' + claims.sub;
      } catch {
        // Malformed token — fall through to IP so it still gets throttled.
      }
    }
  }
  return 'ip:' + (req.ip || req.headers['x-forwarded-for'] || 'unknown');
};

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: API_MAX,
  keyGenerator: userBucket,
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
  keyGenerator: userBucket,
  message: { success: false, error: 'AI service rate limit reached for this user. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tutor RAG chat — separate budget from `aiLimiter` so admin question
// generation can't starve students, and vice-versa. Per-user.
const tutorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: TUTOR_MAX,
  keyGenerator: userBucket,
  message: { success: false, error: 'Tutor rate limit reached. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter, aiLimiter, tutorLimiter };
