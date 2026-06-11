import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

// ── Topic config ──────────────────────────────────────────────────
const TOPICS = [
  'All', 'Arrays', 'Strings', 'Linked Lists', 'Trees',
  'Dynamic Programming', 'Graphs', 'Searching', 'Sorting',
  'Stacks & Queues', 'Backtracking', 'Hashing', 'Math', 'Aptitude',
];

const DIFFICULTY_COLORS = {
  Easy:   { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e', border: 'rgba(34,197,94,0.35)' },
  Medium: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  Hard:   { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444', border: 'rgba(239,68,68,0.35)' },
};

const STATUS_ICON = { solved: '✅', attempted: '🟡', bookmarked: '🔖' };

// ── Inline styles ─────────────────────────────────────────────────
const S = {
  page: {
    padding: '24px 32px',
    minHeight: '100vh',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontFamily: "'Outfit', sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    flexShrink: 0,
  },
  title: { fontSize: 26, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 14, color: 'var(--text-secondary)', margin: '2px 0 0' },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
    marginBottom: 24,
  },
  statCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '14px 18px',
  },
  statValue: { fontSize: 22, fontWeight: 700, margin: 0 },
  statLabel: { fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' },
  toolbar: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    minWidth: 220,
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
  },
  diffPill: (active, diff) => ({
    padding: '6px 14px',
    borderRadius: 20,
    border: `1px solid ${diff ? DIFFICULTY_COLORS[diff].border : 'rgba(255,255,255,0.12)'}`,
    background: active
      ? (diff ? DIFFICULTY_COLORS[diff].bg : 'rgba(99,102,241,0.2)')
      : 'transparent',
    color: active
      ? (diff ? DIFFICULTY_COLORS[diff].text : '#6366f1')
      : 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.18s',
  }),
  topicsRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  topicPill: (active) => ({
    padding: '6px 14px',
    borderRadius: 20,
    border: `1px solid ${active ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
    background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
    color: active ? '#a5b4fc' : 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.18s',
    whiteSpace: 'nowrap',
  }),
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: 20,
    alignItems: 'start',
  },
  table: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 110px 110px 80px',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  problemRow: (solved) => ({
    display: 'grid',
    gridTemplateColumns: '40px 1fr 110px 110px 80px',
    padding: '13px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background 0.15s',
    background: solved ? 'rgba(34,197,94,0.03)' : 'transparent',
  }),
  diffBadge: (diff) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    background: DIFFICULTY_COLORS[diff]?.bg || 'transparent',
    color: DIFFICULTY_COLORS[diff]?.text || '#fff',
    border: `1px solid ${DIFFICULTY_COLORS[diff]?.border || 'transparent'}`,
  }),
  companyChip: {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: 6,
    fontSize: 11,
    background: 'rgba(139,92,246,0.15)',
    color: '#a78bfa',
    border: '1px solid rgba(139,92,246,0.2)',
    marginRight: 4,
    marginBottom: 2,
  },
  panel: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'sticky',
    top: 80,
  },
  panelHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: { fontSize: 15, fontWeight: 600, margin: 0 },
  panelBody: { padding: '20px' },
  problemTitle: { fontSize: 18, fontWeight: 700, margin: '0 0 8px' },
  description: { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 16px' },
  constraints: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 16,
  },
  actionRow: { display: 'flex', gap: 10, marginBottom: 16 },
  btn: (variant) => ({
    flex: variant === 'primary' ? 1 : 'none',
    padding: '10px 18px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    fontFamily: "'Outfit', sans-serif",
    background:
      variant === 'primary' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
      : variant === 'success' ? 'rgba(34,197,94,0.2)'
      : variant === 'warning' ? 'rgba(251,191,36,0.2)'
      : 'rgba(255,255,255,0.07)',
    color:
      variant === 'primary' ? '#fff'
      : variant === 'success' ? '#22c55e'
      : variant === 'warning' ? '#fbbf24'
      : 'var(--text-secondary)',
    transition: 'opacity 0.18s, transform 0.15s',
  }),
  hintBox: {
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 10,
    padding: '14px 16px',
    fontSize: 13,
    lineHeight: 1.7,
    color: 'var(--text-primary)',
    marginTop: 14,
    whiteSpace: 'pre-wrap',
  },
  emptyState: {
    padding: '60px 20px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  progressBar: (pct, color) => ({
    height: 6,
    borderRadius: 3,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 6,
    position: 'relative',
  }),
  progressFill: (pct, color) => ({
    height: '100%',
    width: `${pct}%`,
    background: color || '#6366f1',
    borderRadius: 3,
    transition: 'width 0.6s ease',
  }),
  topicProgressCard: {
    marginBottom: 14,
  },
  topicProgressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    marginBottom: 4,
  },
};

export default function CodingPracticePage() {
  const [problems, setProblems]       = useState([]);
  const [progress, setProgress]       = useState({});
  const [topic, setTopic]             = useState('All');
  const [difficulty, setDifficulty]   = useState('All');
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState(null);
  const [hint, setHint]               = useState('');
  const [hintLevel, setHintLevel]     = useState(0);
  const [hintLoading, setHintLoading] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [activeTab, setActiveTab]     = useState('problems'); // 'problems' | 'progress'

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (topic !== 'All') params.set('topic', topic);
      if (difficulty !== 'All') params.set('difficulty', difficulty);
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get(`/coding/problems?${params}`);
      setProblems(res.data.data?.problems || res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [topic, difficulty, search]);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await api.get('/coding/progress');
      setProgress(res.data.data || {});
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { fetchProblems(); }, [fetchProblems]);
  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // Re-fetch when selected changes to get attempt data
  const selectProblem = async (problem) => {
    setSelected(problem);
    setHint('');
    setHintLevel(0);
    try {
      const res = await api.get(`/coding/problems/${problem.slug}`);
      setSelected(res.data.data?.problem || problem);
    } catch (e) { /* use cached */ }
  };

  // ── Actions ───────────────────────────────────────────────────
  const markAttempt = async (status) => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/coding/attempt', { slug: selected.slug, status });
      setSelected(prev => ({ ...prev, user_status: status }));
      fetchProgress();
      // Update local list
      setProblems(prev => prev.map(p =>
        p.slug === selected.slug ? { ...p, user_status: status } : p
      ));
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const getHint = async () => {
    if (!selected || hintLoading) return;
    setHintLoading(true);
    try {
      const res = await api.post(`/coding/problems/${selected.slug}/hint`, { level: hintLevel });
      setHint(res.data.data?.hint || '');
      setHintLevel(prev => Math.min(prev + 1, 2));
    } catch (e) {
      setHint('Could not get a hint right now. Please try again in a moment.');
    } finally {
      setHintLoading(false);
    }
  };

  // ── Derived stats ─────────────────────────────────────────────
  const totalSolved   = Object.values(progress).reduce((a, t) => a + (t.solved || 0), 0);
  const totalAttempted= Object.values(progress).reduce((a, t) => a + (t.attempted || 0), 0);
  const totalProblems = Object.values(progress).reduce((a, t) => a + (t.total || 0), 0) || problems.length;
  const streak        = progress._streak || 0;

  const diffCounts    = problems.reduce((acc, p) => {
    acc[p.difficulty] = (acc[p.difficulty] || 0) + 1; return acc;
  }, {});

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerIcon}>⚡</div>
        <div>
          <h1 style={S.title}>DSA Practice</h1>
          <p style={S.subtitle}>Crack placements — Arrays, DP, Graphs, Trees &amp; more</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button
            style={{ ...S.diffPill(activeTab === 'problems', null), padding: '8px 18px' }}
            onClick={() => setActiveTab('problems')}
          >📋 Problems</button>
          <button
            style={{ ...S.diffPill(activeTab === 'progress', null), padding: '8px 18px' }}
            onClick={() => setActiveTab('progress')}
          >📊 My Progress</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={S.statsRow}>
        {[
          { value: totalSolved,    label: 'Solved',    color: '#22c55e' },
          { value: totalAttempted, label: 'Attempted', color: '#fbbf24' },
          { value: totalProblems,  label: 'Total Problems', color: '#6366f1' },
          { value: `${streak}🔥`,  label: 'Day Streak', color: '#f97316' },
        ].map(s => (
          <div key={s.label} style={S.statCard}>
            <p style={{ ...S.statValue, color: s.color }}>{s.value}</p>
            <p style={S.statLabel}>{s.label}</p>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'progress' ? (
          <motion.div key="progress"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            <TopicProgressView progress={progress} S={S} />
          </motion.div>
        ) : (
          <motion.div key="problems"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            {/* Toolbar */}
            <div style={S.toolbar}>
              <input
                style={S.searchBox}
                placeholder="🔍  Search problems…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchProblems()}
              />
              {['All', 'Easy', 'Medium', 'Hard'].map(d => (
                <button
                  key={d}
                  style={S.diffPill(difficulty === d, d === 'All' ? null : d)}
                  onClick={() => setDifficulty(d)}
                >{d}</button>
              ))}
            </div>

            {/* Topic pills */}
            <div style={S.topicsRow}>
              {TOPICS.map(t => (
                <button key={t} style={S.topicPill(topic === t)} onClick={() => setTopic(t)}>
                  {t}
                </button>
              ))}
            </div>

            {/* Main layout: problem list + detail panel */}
            <div style={S.layout}>
              {/* Problem list */}
              <div style={S.table}>
                <div style={S.tableHead}>
                  <span>#</span>
                  <span>Problem</span>
                  <span>Difficulty</span>
                  <span>Companies</span>
                  <span>Status</span>
                </div>

                {loading ? (
                  <div style={S.emptyState}>Loading problems…</div>
                ) : problems.length === 0 ? (
                  <div style={S.emptyState}>No problems match your filters.</div>
                ) : (
                  problems.map((p, idx) => (
                    <div
                      key={p.slug}
                      style={{
                        ...S.problemRow(p.user_status === 'solved'),
                        background: selected?.slug === p.slug
                          ? 'rgba(99,102,241,0.1)'
                          : p.user_status === 'solved'
                          ? 'rgba(34,197,94,0.03)'
                          : 'transparent',
                      }}
                      onClick={() => selectProblem(p)}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background =
                          selected?.slug === p.slug ? 'rgba(99,102,241,0.1)'
                          : p.user_status === 'solved' ? 'rgba(34,197,94,0.03)'
                          : 'transparent';
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{idx + 1}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.topic}</div>
                      </div>
                      <span style={S.diffBadge(p.difficulty)}>{p.difficulty}</span>
                      <div>
                        {(p.companies || []).slice(0, 2).map(c => (
                          <span key={c} style={S.companyChip}>{c}</span>
                        ))}
                      </div>
                      <span style={{ fontSize: 16 }}>
                        {p.user_status ? STATUS_ICON[p.user_status] : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Detail panel */}
              <div style={S.panel}>
                {selected ? (
                  <>
                    <div style={S.panelHeader}>
                      <p style={S.panelTitle}>Problem Detail</p>
                      <span style={S.diffBadge(selected.difficulty)}>{selected.difficulty}</span>
                    </div>
                    <div style={S.panelBody}>
                      <h2 style={S.problemTitle}>{selected.title}</h2>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 6, fontSize: 12,
                          background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                          border: '1px solid rgba(99,102,241,0.2)',
                        }}>{selected.topic}</span>
                        {(selected.tags || []).map(tag => (
                          <span key={tag} style={{
                            padding: '3px 10px', borderRadius: 6, fontSize: 12,
                            background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}>{tag}</span>
                        ))}
                      </div>

                      <p style={S.description}>{selected.description}</p>

                      {selected.constraints && (
                        <div style={S.constraints}>
                          <strong style={{ display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                            Constraints
                          </strong>
                          {selected.constraints}
                        </div>
                      )}

                      {/* Companies */}
                      {selected.companies?.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            Asked by:
                          </p>
                          <div>
                            {selected.companies.map(c => (
                              <span key={c} style={S.companyChip}>{c}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={S.actionRow}>
                        <button
                          style={S.btn('success')}
                          onClick={() => markAttempt('solved')}
                          disabled={submitting}
                        >✅ Mark Solved</button>
                        <button
                          style={S.btn('warning')}
                          onClick={() => markAttempt('attempted')}
                          disabled={submitting}
                        >🟡 Attempted</button>
                        <button
                          style={S.btn('default')}
                          onClick={() => markAttempt('bookmarked')}
                          disabled={submitting}
                        >🔖</button>
                      </div>

                      <button
                        style={{ ...S.btn('primary'), width: '100%' }}
                        onClick={getHint}
                        disabled={hintLoading}
                      >
                        {hintLoading ? '🤖 Getting hint…' : `💡 Get AI Hint (Level ${hintLevel + 1})`}
                      </button>

                      {hint && (
                        <div style={S.hintBox}>
                          <strong style={{ display: 'block', marginBottom: 8, color: '#a5b4fc' }}>
                            💡 AI Hint (Level {hintLevel})
                          </strong>
                          {hint}
                        </div>
                      )}

                      {selected.user_status && (
                        <div style={{
                          marginTop: 14, padding: '10px 14px', borderRadius: 8,
                          background: 'rgba(34,197,94,0.08)',
                          border: '1px solid rgba(34,197,94,0.2)',
                          fontSize: 13, color: '#4ade80',
                        }}>
                          {STATUS_ICON[selected.user_status]} You've marked this as <strong>{selected.user_status}</strong>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ ...S.emptyState, padding: '40px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
                    <p>Select a problem to view details and get AI hints</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Topic Progress Sub-view ───────────────────────────────────────
function TopicProgressView({ progress, S }) {
  const topics = Object.entries(progress).filter(([k]) => k !== '_streak');

  const TOPIC_COLORS = {
    'Arrays':              '#6366f1',
    'Strings':             '#8b5cf6',
    'Linked Lists':        '#a78bfa',
    'Trees':               '#22c55e',
    'Dynamic Programming': '#f59e0b',
    'Graphs':              '#ef4444',
    'Searching':           '#06b6d4',
    'Sorting':             '#10b981',
    'Stacks & Queues':     '#f97316',
    'Backtracking':        '#ec4899',
    'Hashing':             '#84cc16',
    'Math':                '#14b8a6',
    'Aptitude':            '#0ea5e9',
  };

  if (topics.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px',
        color: 'var(--text-secondary)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <p>Start solving problems to track your progress by topic.</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 16,
    }}>
      {topics.map(([topicName, stats]) => {
        const pct = stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0;
        const color = TOPIC_COLORS[topicName] || '#6366f1';
        return (
          <div key={topicName} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{topicName}</span>
              <span style={{ fontSize: 13, color }}>
                {stats.solved}/{stats.total}
              </span>
            </div>
            <div style={S.progressBar(pct, color)}>
              <div style={S.progressFill(pct, color)} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12 }}>
              <span style={{ color: '#22c55e' }}>✅ {stats.solved} Solved</span>
              <span style={{ color: '#fbbf24' }}>🟡 {stats.attempted || 0} Attempted</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
