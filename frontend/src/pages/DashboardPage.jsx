import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../components/layout/PageTransition';
import StatCard from '../components/dashboard/StatCard';
import { CompletionDoughnut, WeeklyProgressBar } from '../components/dashboard/ProgressChart';
import RecentActivity from '../components/dashboard/RecentActivity';
import UpcomingWidget from '../components/dashboard/UpcomingWidget';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import {
  HiOutlineBookOpen, HiOutlineChartBar, HiOutlineBriefcase,
  HiOutlineSparkles, HiOutlineShieldCheck, HiOutlineAcademicCap,
  HiOutlinePencilSquare, HiOutlineDocumentText, HiOutlineUsers,
  HiOutlineArrowRight, HiOutlineCheckCircle, HiOutlinePlay,
  HiOutlinePlus, HiOutlineBuildingOffice2, HiOutlineCog6Tooth,
} from 'react-icons/hi2';

const timeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ──────────────────────────────────────────────
   Quick-action card
────────────────────────────────────────────── */
function ActionCard({ icon: Icon, title, desc, to, color, badge }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <motion.div
        className="glass-card"
        style={{ padding: '20px', height: '100%', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
        whileHover={{ y: -3 }}
        transition={{ duration: 0.2 }}
      >
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
      </motion.div>
    </Link>
  );
}

/* ──────────────────────────────────────────────
   Enrolled course mini-card
────────────────────────────────────────────── */
function EnrolledCourseRow({ course, enrollment }) {
  const id = course?.id || enrollment?.course_id;
  return (
    <Link to={`/courses/${id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px',
        background: 'rgba(249,115,22,0.04)',
        border: '1px solid rgba(249,115,22,0.08)',
        borderRadius: 'var(--radius-md)',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
          📚
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
      </div>
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
      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <StatCard icon="📚" value={stats?.enrolled_courses  || 0} label="Enrolled Courses"  color="var(--brand-500)"      index={0} />
        <StatCard icon="✅" value={stats?.completed_lessons || 0} label="Lessons Completed"  color="var(--accent-emerald)" index={1} />
        <StatCard icon="📝" value={stats?.quizzes_taken     || 0} label="Quizzes Taken"      color="var(--accent-violet)"  index={2} />
        <StatCard icon="🔥" value={`${stats?.current_streak || 0}d`} label="Day Streak"     color="var(--gold)"           index={3} />
      </div>

      {/* Upcoming calendar events */}
      <UpcomingWidget />

      {/* Feature Quick Actions */}
      <h3 style={{ marginBottom: 14, fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
        Platform Features
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, marginBottom: 28 }}>
        {actions.map((a) => <ActionCard key={a.title} {...a} />)}
      </div>

      {/* Bottom row: charts + enrolled courses */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <motion.div className="glass-card-static" style={{ padding: 22 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Overall Progress</h4>
          <CompletionDoughnut completed={stats?.completed_lessons || 0} total={Math.max(stats?.completed_lessons || 0, 10)} />
        </motion.div>
        <motion.div className="glass-card-static" style={{ padding: 22 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Weekly Activity</h4>
          <WeeklyProgressBar />
        </motion.div>
      </div>

      {/* Enrolled courses + recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <motion.div className="glass-card-static" style={{ padding: 22 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
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
        </motion.div>

        <motion.div className="glass-card-static" style={{ padding: 22 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.52 }}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Recent Activity</h4>
          <RecentActivity activities={stats?.recent_activity || []} />
        </motion.div>
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
        <StatCard icon="📖" value={stats?.enrolled_courses  || 0} label="Courses Teaching"   color="var(--brand-500)"      index={0} />
        <StatCard icon="✅" value={stats?.completed_lessons || 0} label="Lessons Created"    color="var(--accent-emerald)" index={1} />
        <StatCard icon="📝" value={stats?.quizzes_taken     || 0} label="Quizzes Generated"  color="var(--accent-violet)"  index={2} />
        <StatCard icon="⚡" value={stats?.current_streak    || 0} label="AI Calls Made"      color="var(--gold)"           index={3} />
      </div>

      <h3 style={{ marginBottom: 14, fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Educator Tools</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, marginBottom: 28 }}>
        {actions.map((a) => <ActionCard key={a.title} {...a} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <motion.div className="glass-card-static" style={{ padding: 22 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Completion Overview</h4>
          <CompletionDoughnut completed={stats?.completed_lessons || 0} total={Math.max(stats?.completed_lessons || 0, 10)} />
        </motion.div>
        <motion.div className="glass-card-static" style={{ padding: 22 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Weekly Activity</h4>
          <WeeklyProgressBar />
        </motion.div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
   ADMIN DASHBOARD
────────────────────────────────────────────── */
function AdminDashboard({ stats, adminStats }) {
  const actions = [
    { icon: HiOutlineUsers,          title: 'User Management',     desc: 'View, edit roles, and manage all platform users',                to: '/admin', color: 'var(--brand-500)' },
    { icon: HiOutlineBuildingOffice2,title: 'College Management',   desc: 'Manage colleges, branches, sections, and students',             to: '/admin', color: 'var(--accent-cyan)' },
    { icon: HiOutlineBookOpen,       title: 'Course Management',    desc: 'Create, publish, and control access for all courses',           to: '/admin', color: 'var(--accent-emerald)' },
    { icon: HiOutlineAcademicCap,    title: 'Question Bank & Tests','desc': 'Manage test papers, question banks, and assessments',          to: '/admin', color: 'var(--accent-violet)', badge: 'AI' },
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
      {/* System stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 28 }}>
        {systemStats.map((s, i) => (
          <motion.div key={s.label} className="glass-card-static" style={{ padding: '18px 20px' }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <div style={{ font: '700 1.6rem/1 var(--font-display)', color: s.color, marginBottom: 5 }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Role architecture info banner */}
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

      <h3 style={{ marginBottom: 14, fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Admin Panel Sections</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, marginBottom: 28 }}>
        {actions.map((a) => <ActionCard key={a.title} {...a} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <motion.div className="glass-card-static" style={{ padding: 22 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Platform Overview</h4>
          <CompletionDoughnut completed={adminStats?.totalEnrollments || 0} total={Math.max(adminStats?.totalEnrollments || 0, 10)} />
        </motion.div>
        <motion.div className="glass-card-static" style={{ padding: 22 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}>
          <h4 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Weekly Activity</h4>
          <WeeklyProgressBar />
        </motion.div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
   MAIN EXPORT
────────────────────────────────────────────── */
export default function DashboardPage() {
  const user    = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [stats, setStats]           = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [enrolled, setEnrolled]     = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
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
  };

  const role = user?.role || 'student';

  return (
    <PageTransition>
      {/* ── Welcome Banner ── */}
      <motion.div
        style={{
          marginBottom: 28, padding: '22px 26px',
          background: 'linear-gradient(135deg, rgba(249,115,22,0.13) 0%, rgba(251,191,36,0.06) 100%)',
          border: '1px solid rgba(249,115,22,0.18)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          position: 'relative', overflow: 'hidden',
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div style={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.16) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ font: '400 0.78rem/1 var(--font-body)', color: 'var(--brand-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>
            ◎ {timeOfDay()}
          </div>
          <h1 style={{ marginBottom: 5, fontSize: '1.65rem' }}>
            {user?.display_name || 'User'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
            {role === 'admin'
              ? 'Full platform control. Manage colleges, users, courses, and assessments.'
              : role === 'teacher'
              ? 'Create impactful courses and generate AI-powered quizzes for your students.'
              : 'Continue your learning orbit. Your progress awaits.'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, zIndex: 1, flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'white', background: role === 'admin' ? 'var(--brand-500)' : role === 'teacher' ? 'var(--accent-emerald)' : 'var(--accent-cyan)', padding: '4px 12px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {role === 'teacher' ? 'Educator' : role}
          </div>
          {role === 'admin' && (
            <Link to="/admin">
              <button className="btn btn-primary btn-sm">Open Admin Panel →</button>
            </Link>
          )}
        </div>
      </motion.div>

      {/* ── Role-based content ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[1,2,3,4].map((i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : role === 'admin' ? (
        <AdminDashboard stats={stats} adminStats={adminStats} />
      ) : role === 'teacher' ? (
        <EducatorDashboard stats={stats} />
      ) : (
        <StudentDashboard stats={stats} enrolledCourses={enrolled} />
      )}
    </PageTransition>
  );
}
