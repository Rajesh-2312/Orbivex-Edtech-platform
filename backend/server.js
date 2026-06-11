const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiter');
const { checkHealth } = require('./config/ai');
const { supabase } = require('./config/supabase');

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
const notificationRoutes  = require('./routes/notifications');
const calendarRoutes      = require('./routes/calendar');
const drivesRoutes        = require('./routes/drives');
const billingRoutes       = require('./routes/billing');
const codingRoutes        = require('./routes/coding');
const resumeRoutes        = require('./routes/resume');
const skillgapRoutes      = require('./routes/skillgap');
const pyqRoutes           = require('./routes/pyq');
const lsrwRoutes          = require('./routes/lsrw');
const { addTrialWarning } = require('./middleware/tenantBilling');

const app  = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(addTrialWarning);

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
app.use('/api/notifications',    notificationRoutes);
app.use('/api/calendar',         calendarRoutes);
app.use('/api/drives',           drivesRoutes);
app.use('/api/billing',          billingRoutes);

// Placement Tools Routes
app.use('/api/coding',           codingRoutes);
app.use('/api/resume',           resumeRoutes);
app.use('/api/skillgap',         skillgapRoutes);
app.use('/api/pyq',              pyqRoutes);
app.use('/api/lsrw',             lsrwRoutes);

// Health Check
app.get('/api/health', async (req, res) => {
  const ollamaHealth = await checkHealth();
  let dbStatus = 'disconnected';
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    dbStatus = error ? 'error' : 'connected';
  } catch {
    dbStatus = 'error';
  }
  res.json({
    status    : 'ok',
    service   : 'Orbivex API',
    version   : '3.1.0',
    timestamp : new Date().toISOString(),
    database  : dbStatus,
    ai        : ollamaHealth,
    billing   : process.env.RAZORPAY_KEY_ID ? 'configured' : 'not_configured',
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
  console.error('Server error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Start Server
app.listen(PORT, () => {
  console.log('Orbivex API v3.1.0 running on port ' + PORT);
  console.log('Routes: auth, courses, lessons, progress, quizzes, jobs, analytics,');
  console.log('        ai, admin, company-prep, billing, coding, resume, skillgap, pyq');
});

module.exports = app;
