import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HiOutlineClipboardDocumentList,
  HiOutlineClock,
  HiOutlineAcademicCap,
  HiOutlineBuildingOffice2,
  HiOutlineCheckCircle,
  HiOutlinePlay,
  HiOutlineArrowRight,
  HiOutlineChartBar,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import Skeleton from '../components/ui/Skeleton';
import Badge from '../components/ui/Badge';
import api from '../lib/api';

const FILTERS = ['all', 'available', 'completed'];

function TestCard({ test, onStart, onResult }) {
  const sub = test.my_submission;
  const isSubmitted = sub?.status === 'submitted' || sub?.status === 'evaluated';
  const isInProgress = sub?.status === 'in_progress';

  const percentage = isSubmitted && sub.total_marks > 0
    ? Math.round((sub.obtained_marks / sub.total_marks) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            font: '600 1rem/1.3 var(--font-display)',
            color: 'var(--text-primary)',
            margin: '0 0 6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {test.title}
          </h3>
          {test.description && (
            <p style={{
              font: '400 0.8rem/1.4 var(--font-body)',
              color: 'var(--text-muted)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {test.description}
            </p>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
          {isSubmitted ? (
            <Badge variant="success">Completed</Badge>
          ) : isInProgress ? (
            <Badge variant="warning">In Progress</Badge>
          ) : (
            <Badge variant="primary">Available</Badge>
          )}
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <MetaChip icon={HiOutlineClock} label={`${test.duration_minutes || '—'} min`} />
        <MetaChip icon={HiOutlineChartBar} label={`${test.total_marks || '—'} marks`} />
        <MetaChip
          icon={test.test_type === 'academic' ? HiOutlineAcademicCap : HiOutlineBuildingOffice2}
          label={test.test_type === 'company-specific' && test.company_name
            ? test.company_name
            : test.test_type === 'academic' ? 'Academic' : 'Company'}
        />
        {test.branches?.name && (
          <MetaChip icon={HiOutlineBuildingOffice2} label={test.branches.name} />
        )}
      </div>

      {/* Score if submitted */}
      {isSubmitted && percentage !== null && (
        <div style={{
          background: 'rgba(249,115,22,0.06)',
          border: '1px solid rgba(249,115,22,0.15)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: percentage >= 60
              ? 'linear-gradient(135deg,#059669,#34d399)'
              : 'linear-gradient(135deg,#e11d48,#fb7185)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '700 0.85rem/1 var(--font-display)', color: '#fff', flexShrink: 0,
          }}>
            {percentage}%
          </div>
          <div>
            <div style={{ font: '600 0.82rem/1.2 var(--font-body)', color: 'var(--text-primary)' }}>
              {sub.obtained_marks} / {sub.total_marks} marks
            </div>
            <div style={{ font: '400 0.72rem/1.2 var(--font-body)', color: 'var(--text-muted)', marginTop: 2 }}>
              {percentage >= 60 ? 'Passed' : 'Failed'}
            </div>
          </div>
        </div>
      )}

      {/* Action */}
      <div style={{ marginTop: 'auto' }}>
        {isSubmitted ? (
          <button
            className="btn btn-ghost"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={() => onResult(test.id)}
          >
            <HiOutlineCheckCircle size={16} />
            View Result
          </button>
        ) : (
          <button
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={() => onStart(test.id)}
          >
            {isInProgress ? <HiOutlineArrowRight size={16} /> : <HiOutlinePlay size={16} />}
            {isInProgress ? 'Continue Test' : 'Start Test'}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function MetaChip({ icon: Icon, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      font: '400 0.75rem/1 var(--font-body)', color: 'var(--text-secondary)',
    }}>
      <Icon size={13} style={{ color: 'var(--brand-400)', flexShrink: 0 }} />
      {label}
    </div>
  );
}

export default function TestsPage() {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/tests').then(r => {
      setTests(r.data.data || []);
    }).catch(() => setTests([])).finally(() => setLoading(false));
  }, []);

  const filtered = tests.filter(t => {
    if (filter === 'all') return true;
    const sub = t.my_submission;
    const done = sub?.status === 'submitted' || sub?.status === 'evaluated';
    return filter === 'completed' ? done : !done;
  });

  return (
    <PageTransition>
      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-md)',
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiOutlineClipboardDocumentList size={20} color="#fff" />
          </div>
          <h1 style={{ font: '700 1.6rem/1 var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
            My Tests
          </h1>
        </div>
        <p style={{ font: '400 0.88rem/1.4 var(--font-body)', color: 'var(--text-secondary)', margin: 0 }}>
          Tests assigned to your college and branch
        </p>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              border: filter === f ? '1px solid var(--brand-500)' : '1px solid rgba(249,115,22,0.15)',
              background: filter === f ? 'rgba(249,115,22,0.15)' : 'transparent',
              color: filter === f ? 'var(--brand-400)' : 'var(--text-muted)',
              font: '500 0.8rem/1 var(--font-body)',
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '16px' }}>
          {[1, 2, 3].map(i => <Skeleton key={i} height="240px" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          color: 'var(--text-muted)', font: '400 0.9rem/1.6 var(--font-body)',
        }}>
          <HiOutlineClipboardDocumentList size={48} style={{ opacity: 0.3, marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
          {filter === 'all'
            ? 'No tests have been assigned to your college/branch yet.'
            : `No ${filter} tests.`}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '16px' }}>
          {filtered.map(test => (
            <TestCard
              key={test.id}
              test={test}
              onStart={id => navigate(`/tests/${id}`)}
              onResult={id => navigate(`/tests/${id}/result`)}
            />
          ))}
        </div>
      )}
    </PageTransition>
  );
}
