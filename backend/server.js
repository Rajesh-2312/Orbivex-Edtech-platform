const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { apiLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiter');
const { checkHealth } = require('./config/ollama');
const { supabase } = require('./config/supabase');

// Import routes
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const lessonRoutes = require('./routes/lessons');
const progressRoutes = require('./routes/progress');
const quizRoutes = require('./routes/quizzes');
const jobRoutes = require('./routes/jobs');
const analyticsRoutes = require('./routes/analytics');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const testRoutes = require('./routes/tests');
const companyPrepRoutes = require('./routes/companyPrep');
const adminCompanyPrepRoutes = require('./routes/adminCompanyPrep');
const tutorRoutes = require('./routes/tutor');
const notificationRoutes = require('./routes/notifications');
const calendarRoutes = require('./routes/calendar');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Global Middleware ───
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-domain.com']
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000'],
  credentials: true,
}));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiters ───
app.use('/api/auth', authLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api', apiLimiter);

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin/company-prep', adminCompanyPrepRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/company-prep', companyPrepRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/calendar', calendarRoutes);

// ─── Health Check ───
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
    status: 'ok',
    service: 'Orbivex API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    ollama: ollamaHealth,
  });
});

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Error Handler ───
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║                                           ║
  ║   🎓 Orbivex API                         ║
  ║   Running on http://localhost:${PORT}       ║
  ║                                           ║
  ║   Routes:                                 ║
  ║   ├─ /api/auth     (signup/login)         ║
  ║   ├─ /api/courses  (CRUD)                 ║
  ║   ├─ /api/lessons  (CRUD)                 ║
  ║   ├─ /api/progress (tracking)             ║
  ║   ├─ /api/quizzes  (take/submit)          ║
  ║   ├─ /api/jobs     (board)                ║
  ║   ├─ /api/analytics(dashboard)            ║
  ║   ├─ /api/ai       (agents)              ║
  ║   ├─ /api/admin    (management)          ║
  ║   ├─ /api/company-prep (placement)        ║
  ║   ├─ /api/tutor    (RAG chatbot)          ║
  ║   ├─ /api/notifications (bell + email)    ║
  ║   ├─ /api/calendar (schedules + deadlines)║
  ║   └─ /api/health   (status)              ║
  ║                                           ║
  ╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
