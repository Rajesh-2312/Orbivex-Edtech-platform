import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineUsers, HiOutlineBookOpen, HiOutlineAcademicCap,
  HiOutlineBriefcase, HiOutlineChartBar, HiOutlinePencilSquare,
  HiOutlineTrash, HiOutlinePlus, HiOutlineArrowPath,
  HiOutlineShieldCheck, HiOutlineClipboardDocumentList,
  HiOutlineBuildingOffice2, HiOutlineUserGroup, HiOutlineCpuChip,
  HiOutlineDocumentCheck, HiOutlineChevronDown, HiOutlineChevronRight,
  HiOutlineEye, HiOutlineEyeSlash, HiOutlineDocumentText,
  HiOutlineVideoCamera, HiOutlineClock,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import StatCard from '../components/dashboard/StatCard';
import AdminCollegeTab from '../components/admin/AdminCollegeTab';
import AdminStudentTab from '../components/admin/AdminStudentTab';
import AdminEducatorTab from '../components/admin/AdminEducatorTab';
import AdminTestTab from '../components/admin/AdminTestTab';
import AdminCourseAccessPanel from '../components/admin/AdminCourseAccessPanel';
import { HiOutlineSparkles, HiOutlineLockClosed } from 'react-icons/hi2';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import useUiStore from '../store/uiStore';
import api from '../lib/api';

const TABS = [
  { key: 'overview', label: 'Overview', Icon: HiOutlineChartBar },
  { key: 'colleges', label: 'Colleges', Icon: HiOutlineBuildingOffice2 },
  { key: 'students', label: 'Students', Icon: HiOutlineUserGroup },
  { key: 'educators', label: 'Educators', Icon: HiOutlineCpuChip },
  { key: 'tests', label: 'Tests & Questions', Icon: HiOutlineDocumentCheck },
  { key: 'users', label: 'Users', Icon: HiOutlineUsers },
  { key: 'courses', label: 'Courses', Icon: HiOutlineBookOpen },
  { key: 'lessons', label: 'Lessons', Icon: HiOutlineAcademicCap },
  { key: 'jobs', label: 'Jobs', Icon: HiOutlineBriefcase },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const addToast = useUiStore((s) => s.addToast);

  return (
    <PageTransition>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <HiOutlineShieldCheck size={28} style={{ color: 'var(--primary-500)' }} />
        <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
      </div>
      <p className="text-muted" style={{ marginBottom: '24px' }}>Manage your platform</p>

      {/* Tab bar */}
      <div className="admin-tabs">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`admin-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'colleges' && <AdminCollegeTab addToast={addToast} />}
          {activeTab === 'students' && <AdminStudentTab addToast={addToast} />}
          {activeTab === 'educators' && <AdminEducatorTab addToast={addToast} />}
          {activeTab === 'tests' && <AdminTestTab addToast={addToast} />}
          {activeTab === 'users' && <UsersPanel addToast={addToast} />}
          {activeTab === 'courses' && <CoursesPanel addToast={addToast} />}
          {activeTab === 'lessons' && <LessonsPanel addToast={addToast} />}
          {activeTab === 'jobs' && <JobsPanel addToast={addToast} />}
        </motion.div>
      </AnimatePresence>
    </PageTransition>
  );
}

/* ═══════════ OVERVIEW PANEL ═══════════ */
function OverviewPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const res = await api.get('/admin/overview');
      setStats(res.data.data);
    } catch {}
    setLoading(false);
  };

  if (loading) return <div className="admin-loading">Loading overview...</div>;
  if (!stats) return <div className="text-muted">Failed to load overview</div>;

  return (
    <div className="stats-grid" style={{ marginTop: '16px' }}>
      <StatCard icon={<HiOutlineUsers size={24} />} value={stats.totalUsers} label="Total Users" color="#6366f1" index={0} />
      <StatCard icon={<HiOutlineBuildingOffice2 size={24} />} value={stats.totalColleges} label="Colleges" color="#06b6d4" index={1} />
      <StatCard icon={<HiOutlineBookOpen size={24} />} value={stats.totalCourses} label="Total Courses" color="#8b5cf6" index={2} />
      <StatCard icon={<HiOutlineAcademicCap size={24} />} value={stats.totalLessons} label="Total Lessons" color="#10b981" index={3} />
      <StatCard icon={<HiOutlineClipboardDocumentList size={24} />} value={stats.totalEnrollments} label="Enrollments" color="#f59e0b" index={4} />
      <StatCard icon={<HiOutlineCpuChip size={24} />} value={stats.totalEducators} label="Educators" color="#ec4899" index={5} />
      <StatCard icon={<HiOutlineBriefcase size={24} />} value={stats.totalJobs} label="Jobs Posted" color="#14b8a6" index={6} />
      <StatCard icon={<HiOutlineUsers size={24} />} value={stats.recentSignups} label="Signups (7d)" color="#ef4444" index={7} />
    </div>
  );
}

/* ═══════════ USERS PANEL ═══════════ */
function UsersPanel({ addToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data || []);
    } catch {}
    setLoading(false);
  };

  const changeRole = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      addToast(`Role updated to ${newRole}`, 'success');
      loadUsers();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to update role', 'error');
    }
  };

  const deleteUser = async (userId, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      addToast('User deleted', 'success');
      loadUsers();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  if (loading) return <div className="admin-loading">Loading users...</div>;

  return (
    <div className="admin-table-wrap">
      <div className="admin-table-header">
        <h3>{users.length} Users</h3>
        <Button variant="ghost" size="sm" onClick={loadUsers}><HiOutlineArrowPath size={16} /> Refresh</Button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Display Name</th>
            <th>Email / Username</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.display_name || '—'}</td>
              <td className="text-muted">{u.username || u.email || '—'}</td>
              <td>
                <select
                  className="admin-role-select"
                  value={u.role || 'student'}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td className="text-muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
              <td>
                <button className="admin-icon-btn danger" title="Delete user" onClick={() => deleteUser(u.id, u.display_name)}>
                  <HiOutlineTrash size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <div className="admin-empty">No users yet</div>}
    </div>
  );
}

/* ═══════════ COURSES PANEL ═══════════ */
function CoursesPanel({ addToast }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', difficulty: 'beginner' });
  const [showGenModal, setShowGenModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStage, setGenStage] = useState(0);
  const [genElapsed, setGenElapsed] = useState(0);
  const [genForm, setGenForm] = useState({ subject: '', difficulty: 'beginner', num_lessons: 5, audience: 'undergraduate students', publish: false });

  const GEN_STAGES = [
    { label: 'Connecting to Ollama', pct: 10 },
    { label: 'Drafting course outline', pct: 30 },
    { label: 'Generating lessons', pct: 65 },
    { label: 'Saving to database', pct: 90 },
    { label: 'Finalizing', pct: 98 },
  ];

  useEffect(() => {
    if (!generating) return;
    const start = Date.now();
    const estimate = 60000;
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      setGenElapsed(Math.floor(elapsed / 1000));
      const target = Math.min(95, (1 - Math.exp(-elapsed / (estimate * 0.5))) * 100);
      setGenProgress(target);
      const stageIdx = GEN_STAGES.findIndex((s) => target < s.pct);
      setGenStage(stageIdx === -1 ? GEN_STAGES.length - 1 : stageIdx);
    }, 200);
    return () => clearInterval(tick);
  }, [generating]);
  const [accessCourse, setAccessCourse] = useState(null);

  useEffect(() => { loadCourses(); }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/courses');
      setCourses(res.data.data || []);
    } catch {}
    setLoading(false);
  };

  const createCourse = async () => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    try {
      await api.post('/admin/courses', form);
      addToast('Course created', 'success');
      setShowModal(false);
      setForm({ title: '', description: '', category: 'general', difficulty: 'beginner' });
      loadCourses();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const togglePublish = async (course) => {
    try {
      await api.put(`/admin/courses/${course.id}`, { is_published: !course.is_published });
      addToast(course.is_published ? 'Course unpublished' : 'Course published', 'success');
      loadCourses();
    } catch (err) {
      addToast('Failed to update', 'error');
    }
  };

  const generateCourse = async () => {
    if (!genForm.subject.trim()) { addToast('Subject is required', 'error'); return; }
    setGenProgress(0);
    setGenStage(0);
    setGenElapsed(0);
    setGenerating(true);
    try {
      const res = await api.post('/admin/courses/generate', {
        subject: genForm.subject,
        difficulty: genForm.difficulty,
        num_lessons: Number(genForm.num_lessons) || 5,
        audience: genForm.audience,
        publish: genForm.publish,
      });
      const lessonsCount = res.data.data?.lessons?.length || 0;
      setGenProgress(100);
      setGenStage(GEN_STAGES.length - 1);
      addToast(`Generated course with ${lessonsCount} lessons`, 'success');
      await new Promise((r) => setTimeout(r, 400));
      setShowGenModal(false);
      setGenForm({ subject: '', difficulty: 'beginner', num_lessons: 5, audience: 'undergraduate students', publish: false });
      loadCourses();
    } catch (err) {
      addToast(err.response?.data?.error || 'AI generation failed (is Ollama running & phi3 pulled?)', 'error');
    }
    setGenerating(false);
  };

  const deleteCourse = async (id, title) => {
    if (!confirm(`Delete course "${title}"? This will also delete its lessons.`)) return;
    try {
      await api.delete(`/admin/courses/${id}`);
      addToast('Course deleted', 'success');
      loadCourses();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  if (loading) return <div className="admin-loading">Loading courses...</div>;

  return (
    <>
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h3>{courses.length} Courses</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={() => setShowGenModal(true)}><HiOutlineSparkles size={16} /> Generate with AI</Button>
            <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><HiOutlinePlus size={16} /> Add Course</Button>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Difficulty</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.title}</strong></td>
                <td><Badge variant="primary">{c.category || 'general'}</Badge></td>
                <td><Badge variant={c.difficulty === 'advanced' ? 'danger' : c.difficulty === 'intermediate' ? 'warning' : 'success'}>{c.difficulty || 'beginner'}</Badge></td>
                <td>
                  <button className={`admin-status-btn ${c.is_published ? 'published' : 'draft'}`} onClick={() => togglePublish(c)}>
                    {c.is_published ? 'Published' : 'Draft'}
                  </button>
                </td>
                <td className="text-muted">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                <td>
                  <button className="admin-icon-btn" title="Manage access" onClick={() => setAccessCourse(c)}>
                    <HiOutlineLockClosed size={16} />
                  </button>
                  <button className="admin-icon-btn danger" title="Delete" onClick={() => deleteCourse(c.id, c.title)}>
                    <HiOutlineTrash size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {courses.length === 0 && <div className="admin-empty">No courses yet. Create your first one!</div>}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Course">
        <div className="admin-form">
          <Input label="Title" placeholder="Course title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div style={{ marginTop: '12px' }}>
            <label className="input-label">Description</label>
            <textarea
              className="admin-textarea"
              placeholder="Course description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label className="input-label">Category</label>
              <select className="admin-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="general">General</option>
                <option value="programming">Programming</option>
                <option value="design">Design</option>
                <option value="business">Business</option>
                <option value="science">Science</option>
                <option value="math">Math</option>
              </select>
            </div>
            <div>
              <label className="input-label">Difficulty</label>
              <select className="admin-select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '20px' }} onClick={createCourse}>Create Course</Button>
        </div>
      </Modal>

      <Modal isOpen={showGenModal} onClose={() => !generating && setShowGenModal(false)} title="Generate Course with AI">
        <div className="admin-form">
          <p className="text-muted" style={{ marginTop: 0, fontSize: '13px' }}>
            The AI will draft a full course outline with lessons. Requires Ollama + phi3 model.
          </p>
          <Input
            label="Subject"
            placeholder="e.g. Data Structures in Java"
            value={genForm.subject}
            onChange={(e) => setGenForm({ ...genForm, subject: e.target.value })}
          />
          <div style={{ marginTop: '12px' }}>
            <Input
              label="Target Audience"
              placeholder="undergraduate students"
              value={genForm.audience}
              onChange={(e) => setGenForm({ ...genForm, audience: e.target.value })}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label className="input-label">Difficulty</label>
              <select className="admin-select" value={genForm.difficulty} onChange={(e) => setGenForm({ ...genForm, difficulty: e.target.value })}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="input-label">Number of Lessons</label>
              <select className="admin-select" value={genForm.num_lessons} onChange={(e) => setGenForm({ ...genForm, num_lessons: e.target.value })}>
                {[3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={genForm.publish}
              onChange={(e) => setGenForm({ ...genForm, publish: e.target.checked })}
            />
            Publish immediately
          </label>
          {generating && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-400, #818cf8)' }}>
                  {GEN_STAGES[genStage]?.label}…
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(genProgress)}% · {genElapsed}s
                </span>
              </div>
              <div style={{
                height: '8px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
                marginBottom: '14px',
              }}>
                <div style={{
                  height: '100%',
                  width: `${genProgress}%`,
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
                  backgroundSize: '200% 100%',
                  animation: 'genShimmer 2s linear infinite',
                  transition: 'width 300ms ease-out',
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {GEN_STAGES.map((s, i) => {
                  const done = genProgress >= s.pct || (genProgress === 100 && i <= genStage);
                  const active = i === genStage && !done;
                  return (
                    <div key={s.label} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '12px',
                      color: done ? 'var(--success, #34d399)' : active ? '#e2e8f0' : 'var(--text-muted, #64748b)',
                      opacity: done || active ? 1 : 0.55,
                    }}>
                      <span style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: `2px solid ${done ? '#34d399' : active ? '#a855f7' : '#475569'}`,
                        background: done ? '#34d399' : 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: active ? '0 0 0 4px rgba(168,85,247,0.15)' : 'none',
                        animation: active ? 'genPulse 1.4s ease-in-out infinite' : 'none',
                      }}>
                        {done && <span style={{ color: '#0f172a', fontSize: '10px', fontWeight: 900 }}>✓</span>}
                      </span>
                      {s.label}
                    </div>
                  );
                })}
              </div>
              <style>{`
                @keyframes genShimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
                @keyframes genPulse { 0%, 100% { box-shadow: 0 0 0 4px rgba(168,85,247,0.15); } 50% { box-shadow: 0 0 0 7px rgba(168,85,247,0.05); } }
              `}</style>
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            style={{ width: '100%', marginTop: '20px' }}
            onClick={generateCourse}
            loading={generating}
            disabled={generating}
          >
            {generating ? `Generating… ${genElapsed}s` : 'Generate Course'}
          </Button>
        </div>
      </Modal>

      <AdminCourseAccessPanel
        course={accessCourse}
        isOpen={!!accessCourse}
        onClose={() => setAccessCourse(null)}
        addToast={addToast}
      />
    </>
  );
}

/* ═══════════ LESSONS PANEL ═══════════ */
function LessonsPanel({ addToast }) {
  const [lessons, setLessons] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ course_id: '', title: '', description: '', video_url: '', content_text: '', duration_minutes: 0 });

  // Which course bundles are collapsed (default all open)
  const [collapsedBundles, setCollapsedBundles] = useState({});
  // Which lessons have their content expanded
  const [expandedContent, setExpandedContent] = useState({});
  // Which lesson detail modal is open
  const [viewLesson, setViewLesson] = useState(null);

  useEffect(() => { Promise.all([loadLessons(), loadCourses()]); }, []);

  const loadLessons = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/lessons');
      setLessons(res.data.data || []);
    } catch {}
    setLoading(false);
  };

  const loadCourses = async () => {
    try {
      const res = await api.get('/admin/courses');
      setCourses(res.data.data || []);
    } catch {}
  };

  const createLesson = async () => {
    if (!form.course_id || !form.title.trim()) { addToast('Course and title are required', 'error'); return; }
    try {
      await api.post('/admin/lessons', form);
      addToast('Lesson created', 'success');
      setShowModal(false);
      setForm({ course_id: '', title: '', description: '', video_url: '', content_text: '', duration_minutes: 0 });
      loadLessons();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const deleteLesson = async (id, title) => {
    if (!confirm(`Delete lesson "${title}"?`)) return;
    try {
      await api.delete(`/admin/lessons/${id}`);
      addToast('Lesson deleted', 'success');
      loadLessons();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const toggleBundle = (courseId) =>
    setCollapsedBundles((p) => ({ ...p, [courseId]: !p[courseId] }));

  const toggleContent = (lessonId) =>
    setExpandedContent((p) => ({ ...p, [lessonId]: !p[lessonId] }));

  // Group lessons by course
  const bundles = lessons.reduce((acc, l) => {
    const key = l.course_id || '__none__';
    if (!acc[key]) acc[key] = { title: l.courses?.title || 'Uncategorised', lessons: [] };
    acc[key].lessons.push(l);
    return acc;
  }, {});
  const bundleKeys = Object.keys(bundles).sort((a, b) =>
    bundles[a].title.localeCompare(bundles[b].title)
  );

  if (loading) return <div className="admin-loading">Loading lessons...</div>;

  return (
    <>
      {/* Toolbar */}
      <div className="admin-table-header" style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>{lessons.length} Lessons across {bundleKeys.length} course{bundleKeys.length !== 1 ? 's' : ''}</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="ghost" size="sm" onClick={() => Promise.all([loadLessons(), loadCourses()])}>
            <HiOutlineArrowPath size={16} />
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <HiOutlinePlus size={16} /> Add Lesson
          </Button>
        </div>
      </div>

      {lessons.length === 0 ? (
        <div className="admin-empty">No lessons yet</div>
      ) : (
        bundleKeys.map((key) => {
          const { title: courseTitle, lessons: courseLessons } = bundles[key];
          const isOpen = !collapsedBundles[key];
          return (
            <div
              key={key}
              style={{
                marginBottom: '16px',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              {/* Bundle header */}
              <button
                onClick={() => toggleBundle(key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 18px',
                  background: 'rgba(99,102,241,0.08)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                <HiOutlineBookOpen size={20} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }}>{courseTitle}</span>
                <span style={{
                  fontSize: '0.78rem',
                  padding: '2px 10px',
                  borderRadius: '999px',
                  background: 'rgba(99,102,241,0.18)',
                  color: 'var(--primary-400, #818cf8)',
                  fontWeight: 600,
                }}>
                  {courseLessons.length} lesson{courseLessons.length !== 1 ? 's' : ''}
                </span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
                  {isOpen ? <HiOutlineChevronDown size={18} /> : <HiOutlineChevronRight size={18} />}
                </span>
              </button>

              {/* Lessons list */}
              {isOpen && (
                <div>
                  {courseLessons.map((l, idx) => {
                    const contentOpen = !!expandedContent[l.id];
                    const hasContent = l.content_text && l.content_text.trim().length > 0;
                    const hasVideo = l.video_url && l.video_url.trim().length > 0;
                    return (
                      <div
                        key={l.id}
                        style={{
                          borderTop: idx === 0 ? 'none' : '1px solid var(--border-color)',
                        }}
                      >
                        {/* Lesson row */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 18px',
                          background: contentOpen ? 'rgba(99,102,241,0.04)' : 'transparent',
                        }}>
                          {/* Order index */}
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'rgba(99,102,241,0.15)',
                            color: 'var(--primary-400, #818cf8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            flexShrink: 0,
                          }}>{idx + 1}</span>

                          {/* Title + meta */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{l.title}</div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '2px' }}>
                              {l.duration_minutes > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  <HiOutlineClock size={12} /> {l.duration_minutes} min
                                </span>
                              )}
                              {hasVideo && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  <HiOutlineVideoCamera size={12} /> Video
                                </span>
                              )}
                              {hasContent && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  <HiOutlineDocumentText size={12} /> {l.content_text.length} chars
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              className="admin-icon-btn"
                              title={contentOpen ? 'Hide content' : 'Show content'}
                              onClick={() => toggleContent(l.id)}
                              style={{ color: contentOpen ? 'var(--primary-500)' : undefined }}
                              disabled={!hasContent && !hasVideo}
                            >
                              {contentOpen ? <HiOutlineEyeSlash size={16} /> : <HiOutlineEye size={16} />}
                            </button>
                            <button
                              className="admin-icon-btn danger"
                              title="Delete lesson"
                              onClick={() => deleteLesson(l.id, l.title)}
                            >
                              <HiOutlineTrash size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Inline content panel */}
                        {contentOpen && (
                          <div style={{
                            borderTop: '1px solid var(--border-color)',
                            padding: '16px 18px 18px',
                            background: 'rgba(0,0,0,0.18)',
                          }}>
                            {l.description && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Description</div>
                                <div style={{ fontSize: '0.85rem' }}>{l.description}</div>
                              </div>
                            )}
                            {hasVideo && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Video URL</div>
                                <a href={l.video_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: 'var(--primary-400, #818cf8)', wordBreak: 'break-all' }}>
                                  {l.video_url}
                                </a>
                              </div>
                            )}
                            {hasContent && (
                              <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                  Lesson Content
                                </div>
                                <div style={{
                                  maxHeight: '260px',
                                  overflow: 'auto',
                                  fontSize: '0.82rem',
                                  lineHeight: '1.65',
                                  whiteSpace: 'pre-wrap',
                                  padding: '12px',
                                  background: 'rgba(255,255,255,0.04)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-secondary)',
                                }}>
                                  {l.content_text}
                                </div>
                              </div>
                            )}
                            {!hasContent && !hasVideo && !l.description && (
                              <div className="text-muted" style={{ fontSize: '0.82rem' }}>No content added to this lesson yet.</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Create Lesson Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Lesson">
        <div className="admin-form">
          <div>
            <label className="input-label">Course</label>
            <select className="admin-select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">Select a course...</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <Input label="Title" placeholder="Lesson title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ marginTop: '12px' }} />
          <div style={{ marginTop: '12px' }}>
            <label className="input-label">Description</label>
            <textarea className="admin-textarea" placeholder="Lesson description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <Input label="Video URL" placeholder="https://..." value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} style={{ marginTop: '12px' }} />
          <div style={{ marginTop: '12px' }}>
            <label className="input-label">Content</label>
            <textarea className="admin-textarea" placeholder="Lesson content text (used for AI quiz generation)" value={form.content_text} onChange={(e) => setForm({ ...form, content_text: e.target.value })} rows={4} />
          </div>
          <Input label="Duration (minutes)" type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} style={{ marginTop: '12px' }} />
          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '20px' }} onClick={createLesson}>Create Lesson</Button>
        </div>
      </Modal>
    </>
  );
}

/* ═══════════ JOBS PANEL ═══════════ */
function JobsPanel({ addToast }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', description: '', location: '', type: 'full-time' });

  useEffect(() => { loadJobs(); }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/jobs');
      setJobs(res.data.data || []);
    } catch {}
    setLoading(false);
  };

  const createJob = async () => {
    if (!form.title.trim()) { addToast('Title is required', 'error'); return; }
    try {
      await api.post('/admin/jobs', form);
      addToast('Job posted', 'success');
      setShowModal(false);
      setForm({ title: '', company: '', description: '', location: '', type: 'full-time' });
      loadJobs();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const deleteJob = async (id, title) => {
    if (!confirm(`Delete job "${title}"?`)) return;
    try {
      await api.delete(`/admin/jobs/${id}`);
      addToast('Job deleted', 'success');
      loadJobs();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  if (loading) return <div className="admin-loading">Loading jobs...</div>;

  return (
    <>
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <h3>{jobs.length} Jobs</h3>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><HiOutlinePlus size={16} /> Post Job</Button>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Company</th>
              <th>Location</th>
              <th>Type</th>
              <th>Posted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td><strong>{j.title}</strong></td>
                <td>{j.company || '—'}</td>
                <td className="text-muted">{j.location || '—'}</td>
                <td><Badge variant="primary">{j.type || 'full-time'}</Badge></td>
                <td className="text-muted">{j.created_at ? new Date(j.created_at).toLocaleDateString() : '—'}</td>
                <td>
                  <button className="admin-icon-btn danger" title="Delete" onClick={() => deleteJob(j.id, j.title)}>
                    <HiOutlineTrash size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && <div className="admin-empty">No jobs yet</div>}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Post a Job">
        <div className="admin-form">
          <Input label="Job Title" placeholder="e.g. Frontend Developer" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Company" placeholder="Company name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={{ marginTop: '12px' }} />
          <Input label="Location" placeholder="e.g. Remote, Bangalore" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ marginTop: '12px' }} />
          <div style={{ marginTop: '12px' }}>
            <label className="input-label">Type</label>
            <select className="admin-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="internship">Internship</option>
              <option value="contract">Contract</option>
            </select>
          </div>
          <div style={{ marginTop: '12px' }}>
            <label className="input-label">Description</label>
            <textarea className="admin-textarea" placeholder="Job description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
          </div>
          <Button variant="primary" size="lg" style={{ width: '100%', marginTop: '20px' }} onClick={createJob}>Post Job</Button>
        </div>
      </Modal>
    </>
  );
}
