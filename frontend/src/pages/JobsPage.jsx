import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/layout/PageTransition';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import useUiStore from '../store/uiStore';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import {
  HiOutlineMapPin, HiOutlineBriefcase, HiOutlineMagnifyingGlass,
  HiOutlineCheckCircle, HiOutlineDocumentText, HiOutlineXMark,
  HiOutlineCalendar, HiOutlineArrowPath,
} from 'react-icons/hi2';

const JOB_TYPES = ['All', 'Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'];

function JobCard({ job, applied, onApply, applying }) {
  return (
    <motion.div
      className="glass-card"
      style={{ padding: '22px' }}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1.02rem', marginBottom: 3, color: 'var(--text-primary)' }}>
            {job.title}
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--brand-400)', fontWeight: 500 }}>
            {job.company || 'Company not specified'}
          </div>
        </div>
        {applied && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
            <HiOutlineCheckCircle size={15} /> Applied
          </span>
        )}
      </div>

      <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {job.description || 'No description available'}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {job.location && (
          <Badge variant="info"><HiOutlineMapPin size={11} /> {job.location}</Badge>
        )}
        <Badge variant="primary">
          <HiOutlineBriefcase size={11} /> {job.job_type || 'Full-time'}
        </Badge>
        {job.created_at && (
          <Badge variant="default" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <HiOutlineCalendar size={11} /> {new Date(job.created_at).toLocaleDateString()}
          </Badge>
        )}
      </div>

      <Button
        variant={applied ? 'secondary' : 'primary'}
        size="sm"
        disabled={applied || applying}
        loading={applying}
        onClick={() => !applied && onApply(job.id)}
        style={{ width: '100%' }}
      >
        {applied ? '✓ Application Submitted' : 'Apply Now'}
      </Button>
    </motion.div>
  );
}

function ApplicationCard({ application }) {
  const statusColor = {
    pending:  'var(--gold)',
    reviewed: 'var(--accent-cyan)',
    accepted: 'var(--accent-emerald)',
    rejected: 'var(--accent-rose)',
  }[application.status] || 'var(--text-muted)';

  return (
    <div className="glass-card-static" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <HiOutlineDocumentText size={20} style={{ color: 'var(--brand-400)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 2 }}>
          {application.jobs?.title || 'Job listing removed'}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {application.jobs?.company} · Applied {new Date(application.applied_at || application.created_at).toLocaleDateString()}
        </div>
      </div>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: statusColor, textTransform: 'capitalize', flexShrink: 0 }}>
        {application.status || 'Pending'}
      </span>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs]             = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [applying, setApplying]     = useState(null);
  const [tab, setTab]               = useState('browse'); // 'browse' | 'applications'
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  const addToast = useUiStore((s) => s.addToast);
  const user     = useAuthStore((s) => s.user);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [jobsRes, appsRes] = await Promise.all([
        api.get('/jobs'),
        api.get('/jobs/my/applications'),
      ]);
      setJobs(jobsRes.data.data || []);
      setApplications(appsRes.data.data || []);
    } catch {
      // applications endpoint may not exist — ignore silently
      try {
        const res = await api.get('/jobs');
        setJobs(res.data.data || []);
      } catch {}
    }
    setLoading(false);
  };

  const appliedIds = useMemo(() => new Set(applications.map((a) => a.job_id)), [applications]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchSearch = !search ||
        job.title?.toLowerCase().includes(search.toLowerCase()) ||
        job.company?.toLowerCase().includes(search.toLowerCase()) ||
        job.location?.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'All' || job.job_type === typeFilter;
      return matchSearch && matchType;
    });
  }, [jobs, search, typeFilter]);

  const handleApply = async (jobId) => {
    setApplying(jobId);
    try {
      await api.post(`/jobs/${jobId}/apply`, {});
      // Optimistically mark as applied
      setApplications((prev) => [...prev, { job_id: jobId, status: 'pending', applied_at: new Date().toISOString() }]);
      addToast('Application submitted successfully!', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to apply', 'error');
    }
    setApplying(null);
  };

  return (
    <PageTransition>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Job Board</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Explore career opportunities matched to your skills</p>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, padding: 4, background: 'var(--surface-200)', borderRadius: 12, width: 'fit-content' }}>
        {[
          { id: 'browse',       label: `Browse Jobs (${jobs.length})` },
          { id: 'applications', label: `My Applications (${applications.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer',
              font: '500 0.85rem/1 var(--font-body)',
              transition: 'all 0.2s',
              background: tab === t.id ? 'var(--gradient-brand)' : 'transparent',
              color: tab === t.id ? 'white' : 'var(--text-secondary)',
              boxShadow: tab === t.id ? '0 2px 14px rgba(249,115,22,0.35)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Browse tab ── */}
      {tab === 'browse' && (
        <>
          {/* Search + Filter bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <HiOutlineMagnifyingGlass size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="glass-input"
                style={{ paddingLeft: 40 }}
                placeholder="Search jobs, companies, locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {JOB_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  style={{
                    padding: '7px 14px', borderRadius: 'var(--radius-full)',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                    transition: 'all 0.18s',
                    background: typeFilter === type ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.04)',
                    color: typeFilter === type ? 'var(--brand-300)' : 'var(--text-muted)',
                    border: typeFilter === type ? '1px solid rgba(249,115,22,0.35)' : '1px solid transparent',
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            {(search || typeFilter !== 'All') && (
              <button
                onClick={() => { setSearch(''); setTypeFilter('All'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: 'none', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                <HiOutlineXMark size={14} /> Clear
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
              {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />)}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3 className="empty-state-title">{jobs.length === 0 ? 'No jobs posted yet' : 'No results found'}</h3>
              <p className="empty-state-text">{jobs.length === 0 ? 'Check back later for new opportunities.' : 'Try different search terms or filters.'}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
                {filteredJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    applied={appliedIds.has(job.id)}
                    applying={applying === job.id}
                    onApply={handleApply}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </>
      )}

      {/* ── Applications tab ── */}
      {tab === 'applications' && (
        <div>
          {applications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3 className="empty-state-title">No applications yet</h3>
              <p className="empty-state-text">Browse the job board and apply to your first opportunity.</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => setTab('browse')}>
                Browse Jobs
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                {applications.length} application{applications.length !== 1 ? 's' : ''} submitted
              </div>
              {applications.map((app, i) => (
                <motion.div key={app.job_id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <ApplicationCard application={app} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}
