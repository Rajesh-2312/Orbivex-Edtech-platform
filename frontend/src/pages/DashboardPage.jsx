import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  motion, useMotionValue, useSpring, useTransform, useMotionTemplate, useReducedMotion,
} from 'framer-motion';
import PageTransition from '../components/layout/PageTransition';
import StatCard from '../components/dashboard/StatCard';
import { CompletionDoughnut, WeeklyProgressBar } from '../components/dashboard/ProgressChart';
import RecentActivity from '../components/dashboard/RecentActivity';
import UpcomingWidget from '../components/dashboard/UpcomingWidget';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import { useProgress } from '../hooks/useRealtime';
import {
  HiOutlineBookOpen, HiOutlineChartBar, HiOutlineBriefcase,
  HiOutlineSparkles, HiOutlineAcademicCap,
  HiOutlineDocumentText, HiOutlineUsers,
  HiOutlineArrowRight, HiOutlineCheckCircle, HiOutlinePlay,
  HiOutlinePlus, HiOutlineBuildingOffice2, HiOutlineCog6Tooth,
  HiOutlineFire, HiOutlineBolt, HiOutlineClipboardDocumentList,
} from 'react-icons/hi2';

const timeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* Orchestration variants for cinematic staggered reveals */
const stage = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } } };
const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

/* ──────────────────────────────────────────────
   Drifting aurora backdrop
────────────────────────────────────────────── */
function CinematicBackground() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="dash-aurora" aria-hidden="true">
      <div className="dash-aurora-blob b1" />
      <div className="dash-aurora-blob b2" />
      <div className="dash-aurora-blob b3" />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Mission-control hero with pointer parallax
────────────────────────────────────────────── */
const ROLE_META = {
  admin:   { label: 'Admin',    grad: 'linear-gradient(135deg,#f97316,#fbbf24)', copy: 'Full platform control. Manage colleges, users, courses, and assessments.' },
  tpo:     { label: 'TPO',      grad: 'linear-gradient(135deg,#a855f7,#22d3ee)', copy: 'Manage placement drives, track student readiness, and generate NAAC reports.' },
  teacher: { label: 'Educator', grad: 'linear-gradient(135deg,#10b981,#34d399)', copy: 'Create impactful courses and generate AI-powered quizzes for your students.' },
  student: { label: 'Student',  grad: 'linear-gradient(135deg,#06b6d4,#22d3ee)', copy: 'Continue your learning orbit. Your progress awaits.' },
};

function CommandHero({ user, role }) {
  const reduce = useReducedMotion();
  const meta = ROLE_META[role] || ROLE_META.student;

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 60, damping: 18 });
  const spy = useSpring(py, { stiffness: 60, damping: 18 });

  const handleMove = (e) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width - 0.5) * 28);
    py.set(((e.clientY - r.top) / r.height - 0.5) * 22);
  };
  const handleLeave = () => { px.set(0); py.set(0); };

  return (
    <motion.div
      className="dash-hero"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div className="dash-hero-parallax" style={{ x: spx, y: spy }} />

      <div className="dash-hero-main">
        <motion.div
          className="dash-hero-eyebrow"
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
        >
          <span className="dash-hero-pulse" /> {timeOfDay()}
        </motion.div>
        <motion.h1
          className="dash-hero-title"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.6 }}
        >
          {user?.display_name || user?.email?.split('@')[0] || 'User'}
        </motion.h1>
        <motion.p
          className="dash-hero-sub"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
        >
          {meta.copy}
        </motion.p>
      </div>

      <div className="dash-hero-side">
        <span className="dash-role-badge" style={{ background: meta.grad }}>{meta.label}</span>
        {role === 'admin' && <Link to="/admin"><button className="btn btn-primary btn-sm">Open Admin Panel →</button></Link>}
        {role === 'tpo' && <Link to="/placement"><button className="btn btn-primary btn-sm">TPO Dashboard →</button></Link>}
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   3D-tilt quick-action card
────────────────────────────────────────────── */
function ActionCard({ icon: Icon, title, desc, to, color, badge }) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 220, damping: 18 });
  const sry = useSpring(ry, { stiffness: 220, damping: 18 });
  const glowLeft = useTransform(gx, (v) => `${v}%`);
  const glowTop = useTransform(gy, (v) => `${v}%`);

  const handleMove = (e) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    ry.set((fx - 0.5) * 11);
    rx.set(-(fy - 0.5) * 11);
    gx.set(fx * 100);
    gy.set(fy * 100);
  };
  const handleLeave = () => { rx.set(0); ry.set(0); gx.set(50); gy.set(50); };

  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <motion.div
        className="glass-card dash-tilt dash-action"
        variants={rise}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ rotateX: srx, rotateY: sry, transformPerspective: 900, '--act-color': color }}
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      >
        <motion.div
          className="dash-action-glow"
          style={{ left: glowLeft, top: glowTop, marginLeft: -110, marginTop: -110 }}
        />
        <div className="dash-tilt-inner">
          {badge && (
            <span style={{ position: 'absolute', top: 12, right: 12, fontSize: '0.68rem', fontWeight: 700, color: 'white', background: 'var(--brand-500)', padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {badge}
            </span>
          )}
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Icon size={22} style={{ color }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 5 }}>{title}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 14, fontSize: '0.78rem', color, fontWeight: 600 }}>
            Open <HiOutlineArrowRight size={13} />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

/* Section heading that reveals on scroll */
function SectionTitle({ children }) {
  return (
    <motion.h3
      className="dash-section-title"
      style={{ marginBottom: 14, fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.h3>
  );
}

/* Glass panel that rises into view */
function RevealPanel({ children, style, delay = 0 }) {
  return (
    <motion.div
      className="glass-card-static"
      style={{ padding: 22, ...style }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function ActionGrid({ actions }) {
  return (
    <motion.div
      variants={stage}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, marginBottom: 28 }}
    >
      {actions.map((a) => <ActionCard key={a.title} {...a} />)}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Enrolled course mini-card
────────────────────────────────────────────── */
function EnrolledCourseRow({ course, enrollment }) {
  const id = course?.id || enrollment?.course_id;
  return (
    <Link to={`/courses/${id}`} style={{ textDecoration: 'none' }}>
      <motion.div
        whileHover={{ x: 4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 16px',
          background: 'rgba(249,115,22,0.04)',
          border: '1px solid rgba(249,115,22,0.08)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-400)', flexShrink: 0 }}>
          <HiOutlineBookOpen size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {course?.title || 'Course'}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {course?.category || 'General'} · {course?.difficulty || 'Beginner'}
          </div>
        </div>
        <HiOutlinePlay size={16} style={{ color: 'var(--brand-400)', flexShrink: 0 }} />
      </motion.div>
    </Link>
  );
}

/* ──────────────────────────────────────────────
   STUDENT DASHBOARD
────────────────────────────────────────────── */
function StudentDashboard({ stats, enrolledCourses }) {
  const actions = [
    { icon: HiOutlineBookOpen,      title: 'Browse Courses',    desc: 'Explore all available courses and enroll in new ones',           to: '/courses',  color: 'var(--brand-500)' },
    { icon: HiOutlineChartBar,      title: 'My Progress',       desc: 'View completion rates and quiz scores across your courses',       to: '/progress', color: 'var(--accent-emerald)' },
    { icon: HiOutlineAcademicCap,   title: 'Take a Quiz',       desc: 'Practice your knowledge with AI-generated MCQ quizzes',          to: '/courses',  color: 'var(--accent-violet)', badge: 'AI' },
    { icon: HiOutlineBriefcase,     title: 'Job Board',         desc: 'Browse companies hiring and submit your applications',           to: '/jobs',     color: 'var(--accent-cyan)' },
    { icon: HiOutlineSparkles,      title: 'AI Studio',         desc: 'Get AI-generated summaries, quiz prep, and recommendations',     to: '/ai-studio',color: 'var(--gold)', badge: 'AI' },
    { icon: HiOutlineCog6Tooth,     title: 'Settings',          desc: 'Update your profile, display name, and account info',            to: '/settings', color: 'var(--text-muted)' },
  ];

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <StatCard icon={<HiOutlineBookOpen size={22} />}                value={stats?.enrolled_courses  || 0} label="Enrolled Courses"  color="var(--brand-500)"      index={0} />
        <StatCard icon={<HiOutlineCheckCircle size={22} />}             value={stats?.completed_lessons || 0} label="Lessons Completed"  color="var(--accent-emerald)" index={1} />
        <StatCard icon={<HiOutlineClipboardDocumentList size={22} />}   value={stats?.quizzes_taken     || 0} label="Quizzes Taken"      color="var(--accent-violet)"  index={2} />
        <StatCard icon={<HiOutlineFire size={22} />}                    value={`${stats?.current_streak || 0}d`} label="Day Streak"     color="var(--gold)"           index={3} />
      </div>

      <UpcomingWidget />

      <SectionTitle>Platform Features</SectionTitle>
      <ActionGrid actions={actions} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <RevealPanel>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Overall Progress</h4>
          <CompletionDoughnut completed={stats?.completed_lessons || 0} total={Math.max(stats?.completed_lessons || 0, 10)} />
        </RevealPanel>
        <RevealPanel delay={0.08}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Weekly Activity</h4>
          <WeeklyProgressBar />
        </RevealPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <RevealPanel delay={0.12}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ fontSize: '0.95rem', margin: 0 }}>My Courses</h4>
            <Link to="/courses" style={{ fontSize: '0.78rem', color: 'var(--brand-400)', fontWeight: 500 }}>View all →</Link>
          </div>
          {enrolledCourses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No enrolled courses yet.<br />
              <Link to="/courses" style={{ color: 'var(--brand-400)', fontWeight: 500 }}>Browse courses →</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {enrolledCourses.slice(0, 4).map((e, i) => (
                <EnrolledCourseRow key={i} course={e.courses} enrollment={e} />
              ))}
            </div>
          )}
        </RevealPanel>

        <RevealPanel delay={0.16}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Recent Activity</h4>
          <RecentActivity activities={stats?.recent_activity || []} />
        </RevealPanel>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
   EDUCATOR DASHBOARD
────────────────────────────────────────────── */
function EducatorDashboard({ stats }) {
  const actions = [
    { icon: HiOutlinePlus,          title: 'Create Course',       desc: 'Author a new course with lessons, content, and quizzes',         to: '/courses',   color: 'var(--brand-500)', badge: 'New' },
    { icon: HiOutlineSparkles,      title: 'AI Course Generator', desc: 'Generate a complete course outline from a subject prompt',       to: '/ai-studio', color: 'var(--gold)', badge: 'AI' },
    { icon: HiOutlineAcademicCap,   title: 'AI Quiz Generator',   desc: 'Create MCQ quizzes automatically from lesson content',           to: '/ai-studio', color: 'var(--accent-violet)', badge: 'AI' },
    { icon: HiOutlineDocumentText,  title: 'Manage Lessons',      desc: 'Add, edit, and reorder lessons across your courses',             to: '/courses',   color: 'var(--accent-cyan)' },
    { icon: HiOutlineChartBar,      title: 'Analytics',           desc: 'View enrollment counts, completion rates, and quiz scores',      to: '/progress',  color: 'var(--accent-emerald)' },
    { icon: HiOutlineBriefcase,     title: 'Job Board',           desc: 'Browse and apply to industry opportunities',                    to: '/jobs',      color: 'var(--accent-cyan)' },
  ];

  return (
    <>
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <StatCard icon={<HiOutlineBookOpen size={22} />}              value={stats?.enrolled_courses  || 0} label="Courses Teaching"   color="var(--brand-500)"      index={0} />
        <StatCard icon={<HiOutlineCheckCircle size={22} />}           value={stats?.completed_lessons || 0} label="Lessons Created"    color="var(--accent-emerald)" index={1} />
        <StatCard icon={<HiOutlineClipboardDocumentList size={22} />} value={stats?.quizzes_taken     || 0} label="Quizzes Generated"  color="var(--accent-violet)"  index={2} />
        <StatCard icon={<HiOutlineBolt size={22} />}                  value={stats?.current_streak    || 0} label="AI Calls Made"      color="var(--gold)"           index={3} />
      </div>

      <SectionTitle>Educator Tools</SectionTitle>
      <ActionGrid actions={actions} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <RevealPanel>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Completion Overview</h4>
          <CompletionDoughnut completed={stats?.completed_lessons || 0} total={Math.max(stats?.completed_lessons || 0, 10)} />
        </RevealPanel>
        <RevealPanel delay={0.08}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Weekly Activity</h4>
          <WeeklyProgressBar />
        </RevealPanel>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
   ADMIN DASHBOARD
────────────────────────────────────────────── */
function AdminDashboard({ adminStats }) {
  const actions = [
    { icon: HiOutlineUsers,          title: 'User Management',     desc: 'View, edit roles, and manage all platform users',                to: '/admin', color: 'var(--brand-500)' },
    { icon: HiOutlineBuildingOffice2,title: 'College Management',   desc: 'Manage colleges, branches, sections, and students',             to: '/admin', color: 'var(--accent-cyan)' },
    { icon: HiOutlineBookOpen,       title: 'Course Management',    desc: 'Create, publish, and control access for all courses',           to: '/admin', color: 'var(--accent-emerald)' },
    { icon: HiOutlineAcademicCap,    title: 'Question Bank & Tests', desc: 'Manage test papers, question banks, and assessments',           to: '/admin', color: 'var(--accent-violet)', badge: 'AI' },
    { icon: HiOutlineSparkles,       title: 'AI Studio',            desc: 'Generate courses, quizzes, grade assignments, detect plagiarism',to: '/ai-studio', color: 'var(--gold)', badge: 'AI' },
    { icon: HiOutlineBriefcase,      title: 'Job Board Admin',      desc: 'Post jobs, manage listings, and track applications',            to: '/admin', color: 'var(--accent-amber)' },
  ];

  const systemStats = [
    { label: 'Total Users',       value: adminStats?.totalUsers       || '—', color: 'var(--brand-500)' },
    { label: 'Total Courses',     value: adminStats?.totalCourses     || '—', color: 'var(--accent-emerald)' },
    { label: 'Total Enrollments', value: adminStats?.totalEnrollments || '—', color: 'var(--accent-violet)' },
    { label: 'Total Colleges',    value: adminStats?.totalColleges    || '—', color: 'var(--accent-cyan)' },
  ];

  return (
    <>
      <motion.div
        variants={stage} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 28 }}
      >
        {systemStats.map((s) => (
          <motion.div key={s.label} className="glass-card-static" style={{ padding: '18px 20px' }} variants={rise}>
            <div style={{ font: '700 1.6rem/1 var(--font-display)', color: s.color, marginBottom: 5 }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.label}</div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        style={{ padding: '16px 20px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 'var(--radius-md)', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
      >
        {[
          { role: 'Admin',    color: 'var(--brand-500)',      desc: 'Full platform control — colleges, users, courses, tests, jobs' },
          { role: 'Educator', color: 'var(--accent-emerald)', desc: 'Create courses, lessons, generate AI quizzes, view analytics' },
          { role: 'Student',  color: 'var(--accent-cyan)',    desc: 'Enroll, learn, take quizzes, track progress, apply to jobs' },
        ].map((r) => (
          <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 220px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0, boxShadow: `0 0 8px ${r.color}` }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: r.color }}>{r.role}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 6 }}>— {r.desc}</span>
            </div>
          </div>
        ))}
      </motion.div>

      <SectionTitle>Admin Panel Sections</SectionTitle>
      <ActionGrid actions={actions} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <RevealPanel>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Platform Overview</h4>
          <CompletionDoughnut completed={adminStats?.totalEnrollments || 0} total={Math.max(adminStats?.totalEnrollments || 0, 10)} />
        </RevealPanel>
        <RevealPanel delay={0.08}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Weekly Activity</h4>
          <WeeklyProgressBar />
        </RevealPanel>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
   MAIN EXPORT
────────────────────────────────────────────── */
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const [stats, setStats]           = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [enrolled, setEnrolled]     = useState([]);
  const [loading, setLoading]       = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const promises = [api.get('/analytics/dashboard')];
      if (user?.role === 'admin') promises.push(api.get('/admin/overview'));
      if (user?.role !== 'admin') promises.push(api.get('/courses/my/enrolled'));

      const results = await Promise.all(promises);
      setStats(results[0].data.data);
      if (user?.role === 'admin') setAdminStats(results[1]?.data?.data);
      else setEnrolled(results[1]?.data?.data || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
    setLoading(false);
  }, [user?.role]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: re-fetch dashboard stats whenever a lesson is completed
  useProgress(user?.id, (row) => {
    if (row?.completed) fetchAll();
  });

  const role = user?.role || 'student';

  return (
    <PageTransition>
      <CinematicBackground />
      <div className="dash-stage">
        <CommandHero user={user} role={role} />

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 'var(--radius-lg)' }} />)}
          </div>
        ) : role === 'admin' ? (
          <AdminDashboard adminStats={adminStats} />
        ) : role === 'tpo' || role === 'teacher' ? (
          <EducatorDashboard stats={stats} />
        ) : (
          <StudentDashboard stats={stats} enrolledCourses={enrolled} />
        )}
      </div>
    </PageTransition>
  );
}
