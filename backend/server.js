// Validate configuration before installing process guards so startup errors
// exit immediately and are visible to Render as a failed deployment.
const { allowedOrigins, production } = require('./config/env');

// ── Last-resort process guards ───────────────────────────────────────────────
// A thrown error inside an async route handler becomes an unhandledRejection in
// Express 4 — it never reaches the error middleware below and would otherwise
// crash the whole process (as a bug in routes/coding.js once did, taking every
// student offline over one bad request). Log and keep serving; the offending
// request still fails, but the server survives.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  // Deliberately not exiting: for an API server, surviving one corrupt request
  // beats dropping every in-flight connection. Fatal init errors still throw
  // before listen() and are visible in the logs.
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiter');
const { checkHealth } = require('./config/ai');
const { supabaseAdmin } = require('./config/supabase');

// Import routes
const authRoutes          = require('./routes/auth');
const courseRoutes        = require('./routes/courses');
const lessonRoutes        = require('./routes/lessons');
const progressRoutes      = require('./routes/progress');
const quizRoutes          = require('./routes/quizzes');
const jobRoutes           = require('./routes/jobs');
const analyticsRoutes     = require('./routes/analytics');
const aiRoutes            = require('./routes/ai');
const adminRoutes         = require('./routes/admin');
const testRoutes          = require('./routes/tests');
const companyPrepRoutes   = require('./routes/companyPrep');
const adminCompanyPrepRoutes = require('./routes/adminCompanyPrep');
const tutorRoutes         = require('./routes/tutor');
const assistantRoutes     = require('./routes/assistant');
const notificationRoutes  = require('./routes/notifications');
const calendarRoutes      = require('./routes/calendar');
const drivesRoutes        = require('./routes/drives');
const codingRoutes        = require('./routes/coding');
const resumeRoutes        = require('./routes/resume');
const skillgapRoutes      = require('./routes/skillgap');
const pyqRoutes           = require('./routes/pyq');
const lsrwRoutes          = require('./routes/lsrw');

const app  = express();
const PORT = process.env.PORT || 3001;

// Render terminates HTTPS at its reverse proxy. Trust the nearest proxy so
// IP-based auth throttling uses the client IP instead of a shared proxy IP.
app.set('trust proxy', production ? 1 : false);

// Global Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    const error = new Error('CORS: origin not allowed');
    error.status = 403;
    callback(error);
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
}));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Render's frequent probes must be fast and independent of AI/database calls
// and must not consume the students' API rate-limit budget.
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'Orbivex API' });
});

// Rate Limiters
app.use('/api/auth', authLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api', apiLimiter);

// Core Routes
app.use('/api/auth',             authRoutes);
app.use('/api/courses',          courseRoutes);
app.use('/api/lessons',          lessonRoutes);
app.use('/api/progress',         progressRoutes);
app.use('/api/quizzes',          quizRoutes);
app.use('/api/jobs',             jobRoutes);
app.use('/api/analytics',        analyticsRoutes);
app.use('/api/ai',               aiRoutes);
app.use('/api/admin/company-prep', adminCompanyPrepRoutes);
app.use('/api/admin',            adminRoutes);
app.use('/api/tests',            testRoutes);
app.use('/api/company-prep',     companyPrepRoutes);
app.use('/api/tutor',            tutorRoutes);
app.use('/api/assistant',        assistantRoutes);
app.use('/api/notifications',    notificationRoutes);
app.use('/api/calendar',         calendarRoutes);
app.use('/api/drives',           drivesRoutes);

// Placement Tools Routes
app.use('/api/coding',           codingRoutes);
app.use('/api/resume',           resumeRoutes);
app.use('/api/skillgap',         skillgapRoutes);
app.use('/api/pyq',              pyqRoutes);
app.use('/api/lsrw',             lsrwRoutes);

// Health Check
app.get('/api/health', async (req, res) => {
  const aiHealth = await checkHealth();
  let dbStatus = 'disconnected';
  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    dbStatus = error ? 'error' : 'connected';
  } catch {
    dbStatus = 'error';
  }
  // Agent metrics live alongside AI/db so /api/health is a single self-heal
  // dashboard: provider circuit state + cache + per-agent success rates.
  let agents = {};
  try { agents = require('./agents/agentBase').getAllMetrics(); } catch { /* none yet */ }

  res.json({
    status    : 'ok',
    service   : 'Orbivex API',
    version   : '3.1.0',
    timestamp : new Date().toISOString(),
    database  : dbStatus,
    ai        : aiHealth,
    agents,
    email     : process.env.RESEND_API_KEY  ? 'configured' : 'not_configured',
  });
});

// Agent Health Metrics
app.get('/api/agents/health', (req, res) => {
  try {
    const AgentBase = require('./agents/agentBase');
    res.json({ status: 'ok', agents: AgentBase.getAllMetrics() });
  } catch (err) {
    res.json({ status: 'ok', agents: {} });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route ' + req.method + ' ' + req.path + ' not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  // Honor client errors (e.g. malformed JSON body from body-parser) instead of
  // reporting every failure as a 500.
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('Server error:', err);
  res.status(status).json({
    error: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// Start Server
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('Orbivex API v3.1.0 running on port ' + PORT);
    console.log('Routes: auth, courses, lessons, progress, quizzes, jobs, analytics,');
    console.log('        ai, admin, company-prep, coding, resume, skillgap, pyq');
  });

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      console.log(`${signal}: draining connections`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 10000).unref();
    });
  }
}

module.exports = app;
