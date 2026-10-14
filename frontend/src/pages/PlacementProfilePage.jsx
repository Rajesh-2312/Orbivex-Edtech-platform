import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import PageTransition from '../components/layout/PageTransition';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import {
  HiOutlineUserCircle, HiOutlineAcademicCap, HiOutlineChartBar,
  HiOutlineBriefcase, HiOutlineCheckCircle, HiOutlineTrophy,
  HiOutlineBookOpen, HiOutlineMicrophone, HiOutlineCpuChip,
  HiOutlineArrowTrendingUp, HiOutlineSparkles, HiOutlineUsers,
} from 'react-icons/hi2';

/* Readiness ring */
function ReadinessRing({ score }) {
  const r = 54, stroke = 8, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? 'var(--accent-emerald)' : score >= 50 ? 'var(--brand-500)' : '#f59e0b';
  const label = score >= 75 ? 'Placement Ready' : score >= 50 ? 'Getting There' : 'Needs Work';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg width={130} height={130}>
        <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 1.2s ease' }}
        />
        <text x={65} y={60} textAnchor="middle" fill="white" fontSize={24} fontWeight={800}>{score}</text>
        <text x={65} y={78} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={11}>/100</text>
      </svg>
      <span style={{
        fontSize: '0.8rem', fontWeight: 700, padding: '4px 14px', borderRadius: 99,
        color, background: `${color}18`,
      }}>
        {label}
      </span>
    </div>
  );
}

/* Dimension bar */
function DimensionBar({ label, value, max, icon: Icon, color }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={15} style={{ color }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {value}{typeof max === 'string' ? ` ${max}` : `/${max}`}
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: 99 }}
        />
      </div>
    </div>
  );
}

/* Student list row for TPO view */
function StudentRow({ student, onSelect }) {
  const score = student.readiness_score ?? 0;
  const color = score >= 75 ? 'var(--accent-emerald)' : score >= 50 ? 'var(--brand-500)' : '#f59e0b';
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onSelect(student)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px', borderRadius: 9, marginBottom: 6,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--brand-500), var(--brand-600))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: '1rem', color: '#fff', flexShrink: 0,
      }}>
        {(student.display_name || student.username || '?')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {student.display_name || student.username}
        </div>
        {/* Join only the parts that exist — students without an enrolment number
            or branch were otherwise rendering a bare "·" separator. */}
        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {[student.enrollment_number, student.branches?.name].filter(Boolean).join(' · ') || 'No enrolment details'}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color }}>{score}</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>readiness</div>
      </div>
    </motion.div>
  );
}

/* Profile detail panel */
function ProfilePanel({ studentId, name }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/analytics/placement/student/${studentId}`)
      .then(res => setData(res.data?.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading profile…</div>;
  if (!data) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Could not load profile.</div>;

  const { readiness_score, breakdown, placement } = data;

  const dimensions = [
    { label: 'Courses Enrolled', value: breakdown.courses_enrolled, max: 10, icon: HiOutlineBookOpen, color: 'var(--brand-500)' },
    { label: 'Lessons Completed', value: breakdown.lessons_completed, max: 50, icon: HiOutlineAcademicCap, color: 'var(--accent-cyan)' },
    { label: 'Avg Quiz Score', value: breakdown.avg_quiz_score, max: 100, icon: HiOutlineChartBar, color: 'var(--accent-violet)' },
    { label: 'Tests Evaluated', value: breakdown.tests_evaluated, max: 5, icon: HiOutlineCpuChip, color: '#f59e0b' },
    { label: 'Company Rounds Cleared', value: breakdown.company_rounds_cleared, max: 10, icon: HiOutlineBriefcase, color: 'var(--accent-emerald)' },
    { label: 'Practice Accuracy', value: breakdown.practice_accuracy, max: 100, icon: HiOutlineMicrophone, color: '#a78bfa' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
        <ReadinessRing score={readiness_score} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{name}</h2>
          <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Placement Readiness Score — composite of courses, quizzes, tests, company prep, and practice sessions.
          </p>
          {placement.offers > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 9, padding: '8px 14px',
            }}>
              <HiOutlineTrophy size={16} style={{ color: 'var(--accent-emerald)' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                {placement.accepted > 0
                  ? `Placed · ₹${placement.highest_ctc} LPA`
                  : `${placement.offers} offer${placement.offers > 1 ? 's' : ''} received`}
              </span>
            </div>
          )}
        </div>
      </div>

      <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Skill Dimensions
      </h3>
      {dimensions.map(d => <DimensionBar key={d.label} {...d} />)}

      {/* Quick stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18 }}>
        {[
          { label: 'Quizzes Taken', value: breakdown.quizzes_taken, icon: HiOutlineChartBar },
          { label: 'Practice Sessions', value: breakdown.practice_sessions, icon: HiOutlineMicrophone },
          { label: 'Offers Received', value: placement.offers, icon: HiOutlineTrophy },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 9, padding: '12px 14px', textAlign: 'center',
          }}>
            <s.icon size={18} style={{ color: 'var(--brand-400)', marginBottom: 6 }} />
            <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────── */
export default function PlacementProfilePage() {
  const user = useAuthStore(s => s.user);
  const isTPO = ['admin', 'tpo', 'teacher'].includes(user?.role);

  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState('');

  // TPO: load all students
  useEffect(() => {
    if (!isTPO) return;
    setLoadingStudents(true);

    const loadProfiles = async () => {
      try {
        // Get students from admin endpoint
        const res = await api.get('/admin/students?limit=200');
        const allStudents = res.data?.data?.students || res.data?.data || [];

        // Fetch readiness for each (batch in groups of 5 to avoid hammering)
        const enriched = [];
        for (let i = 0; i < allStudents.length; i += 5) {
          const batch = allStudents.slice(i, i + 5);
          const results = await Promise.allSettled(
            batch.map(s => api.get(`/analytics/placement/student/${s.id}`))
          );
          results.forEach((r, j) => {
            const s = batch[j];
            const score = r.status === 'fulfilled' ? (r.value.data?.data?.readiness_score ?? 0) : 0;
            enriched.push({ ...s, readiness_score: score });
          });
        }
        enriched.sort((a, b) => (b.readiness_score ?? 0) - (a.readiness_score ?? 0));
        setStudents(enriched);
      } catch { setStudents([]); }
      finally { setLoadingStudents(false); }
    };

    loadProfiles();
  }, [isTPO]);

  const filtered = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.display_name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.enrollment_number || '').toLowerCase().includes(q)
    );
  });

  /* Student: show own profile */
  if (!isTPO) {
    return (
      <PageTransition>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HiOutlineSparkles size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>My Placement Profile</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Your readiness score and activity breakdown</p>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '28px' }}>
          <ProfilePanel studentId={user?.id} name={user?.display_name || user?.username} />
        </div>
      </PageTransition>
    );
  }

  /* TPO / Admin: student list + detail */
  return (
    <PageTransition>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HiOutlineUsers size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Student Placement Profiles</h1>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {students.length} student{students.length !== 1 ? 's' : ''} · Sorted by readiness score
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: Student list */}
        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or roll no…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', borderRadius: 9, padding: '9px 14px',
              fontSize: '0.84rem', marginBottom: 12, outline: 'none',
            }}
          />
          <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
            {loadingStudents ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading student profiles…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No students found
              </div>
            ) : (
              filtered.map(s => (
                <StudentRow
                  key={s.id} student={s}
                  onSelect={st => setSelectedStudent(st)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Profile detail */}
        <div className="glass-card" style={{ padding: '28px', minHeight: 400 }}>
          {!selectedStudent ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <HiOutlineUserCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Select a student
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Click on any student from the list to view their placement readiness profile.
              </div>
            </div>
          ) : (
            <ProfilePanel
              studentId={selectedStudent.id}
              name={selectedStudent.display_name || selectedStudent.username}
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
