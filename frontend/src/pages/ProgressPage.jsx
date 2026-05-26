import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../components/layout/PageTransition';
import ProgressBar from '../components/ui/ProgressBar';
import api from '../lib/api';
import { HiOutlineBookOpen, HiOutlineCheckCircle, HiOutlineAcademicCap, HiOutlineChartBar } from 'react-icons/hi2';

function StatTile({ icon: Icon, value, label, color }) {
  return (
    <div className="glass-card-static" style={{ padding: '20px', textAlign: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div style={{ font: '700 1.7rem/1 var(--font-display)', color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

export default function ProgressPage() {
  const [summary, setSummary]           = useState(null);
  const [courseProgress, setCourseProgress] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => { loadProgress(); }, []);

  const loadProgress = async () => {
    try {
      const [summaryRes, enrolledRes] = await Promise.all([
        api.get('/progress/summary'),
        api.get('/courses/my/enrolled'),
      ]);
      setSummary(summaryRes.data.data);

      const enrolled = enrolledRes.data.data || [];

      // Fetch per-course progress in parallel
      const progressResults = await Promise.all(
        enrolled.map(async (enrollment) => {
          const courseId = enrollment.courses?.id || enrollment.course_id;
          if (!courseId) return { ...enrollment, completed: 0, total: 0, percentage: 0 };
          try {
            const res = await api.get(`/progress/course/${courseId}`);
            const p = res.data.data;
            return { ...enrollment, completed: p.completed, total: p.total, percentage: p.percentage };
          } catch {
            return { ...enrollment, completed: 0, total: 0, percentage: 0 };
          }
        })
      );
      setCourseProgress(progressResults);
    } catch (err) {
      console.error('Progress load error:', err);
    }
    setLoading(false);
  };

  return (
    <PageTransition>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 4 }}>Your Progress</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Track your learning journey across all courses</p>
      </div>

      {/* ── Summary Stats ── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          <StatTile icon={HiOutlineBookOpen}    value={summary.enrolled_courses}  label="Enrolled Courses"   color="var(--brand-500)" />
          <StatTile icon={HiOutlineCheckCircle} value={summary.completed_lessons} label="Lessons Completed"  color="var(--accent-emerald)" />
          <StatTile icon={HiOutlineAcademicCap} value={summary.quizzes_taken}     label="Quizzes Taken"      color="var(--accent-violet)" />
          <StatTile icon={HiOutlineChartBar}    value={`${summary.average_score}%`} label="Avg Quiz Score"   color="var(--gold)" />
        </div>
      )}

      {/* ── Per-Course Progress ── */}
      <h3 style={{ marginBottom: 16 }}>Course Progress</h3>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : courseProgress.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h3 className="empty-state-title">No enrolled courses</h3>
          <p className="empty-state-text">Enroll in courses to track your progress here.</p>
          <Link to="/courses" style={{ marginTop: 16, display: 'inline-block' }}>
            <button className="btn btn-primary btn-sm">Browse Courses</button>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {courseProgress.map((enrollment, i) => {
            const course = enrollment.courses || {};
            const pct    = enrollment.percentage || 0;
            const done   = enrollment.completed || 0;
            const total  = enrollment.total || 0;
            const courseId = course.id || enrollment.course_id;

            return (
              <motion.div
                key={courseId || i}
                className="glass-card-static"
                style={{ padding: '20px 24px' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 3, fontSize: '0.98rem' }}>
                      {course.title || 'Untitled Course'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Enrolled {enrollment.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleDateString() : ''}
                      {total > 0 && ` · ${done} of ${total} lessons`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 16 }}>
                    <span style={{
                      font: '700 1.1rem/1 var(--font-display)',
                      color: pct === 100 ? 'var(--accent-emerald)' : 'var(--brand-400)',
                    }}>
                      {pct}%
                    </span>
                    {pct === 100 && (
                      <span style={{ fontSize: '1.1rem' }}>🏆</span>
                    )}
                  </div>
                </div>

                <ProgressBar value={pct} max={100} showLabel={false} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {pct === 100 ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>✓ Completed</span>
                    ) : pct > 0 ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--brand-400)', fontWeight: 600 }}>In Progress</span>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not started</span>
                    )}
                  </div>
                  {courseId && (
                    <Link to={`/courses/${courseId}`} style={{ fontSize: '0.78rem', color: 'var(--brand-400)', fontWeight: 500 }}>
                      Continue →
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
