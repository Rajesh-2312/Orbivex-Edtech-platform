import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineArrowLeft,
  HiOutlineSparkles,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineArrowPath,
  HiOutlineBookOpen,
  HiOutlineCpuChip,
  HiOutlineClock,
  HiOutlineXMark,
  HiOutlineGlobeAlt,
} from 'react-icons/hi2';
import PageTransition from '../components/layout/PageTransition';
import { findCompany } from '../lib/companyPrepData';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

const PYQ_YEAR_OPTIONS = [2025, 2024, 2023, 2022, 2021];

export default function TopicPracticePage() {
  const { slug, index, topicIdx } = useParams();
  const navigate = useNavigate();
  const company = useMemo(() => findCompany(slug), [slug]);
  const roundIndex = Number(index);
  const round = company?.rounds?.[roundIndex];
  const topic = round?.topics?.[Number(topicIdx)];

  const userRole = useAuthStore((s) => s.user?.role);
  const canGenerate = userRole === 'admin' || userRole === 'teacher';

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateAllReport, setGenerateAllReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [answers, setAnswers] = useState({});  // { [questionId]: selectedOptionString }
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // { results, correct, total, percentage }
  const [setNumber, setSetNumber] = useState(null);
  const [totalSets, setTotalSets] = useState(5);
  const [pyqCount, setPyqCount] = useState(0);
  const [aiCount, setAiCount] = useState(0);
  const [needsSeeding, setNeedsSeeding] = useState(false);

  // PYQ seed flow (admin only)
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [seedYears, setSeedYears] = useState([2024, 2023]);
  const [seedTarget, setSeedTarget] = useState(30);
  const [seedJob, setSeedJob] = useState(null); // latest pyq_jobs row
  const [seeding, setSeeding] = useState(false);
  const seedPollRef = useRef(null);
  const [topicStats, setTopicStats] = useState(null); // { total, by_source }
  const [seedStartGap, setSeedStartGap] = useState(0); // gap captured when Start was pressed (for progress bar)

  const color = company?.color || 'var(--brand-400)';

  const fetchQuestions = () => {
    if (!company || !topic) return;
    setErrorMsg('');
    setLoading(true);
    api.get(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${encodeURIComponent(topic)}/questions?limit=30`)
      .then((res) => {
        const payload = res.data?.data || {};
        setQuestions(payload.questions || []);
        setSetNumber(payload.set_number ?? null);
        setTotalSets(payload.total_sets ?? 5);
        setPyqCount(payload.pyq_count ?? 0);
        setAiCount(payload.ai_count ?? 0);
        setNeedsSeeding(!!payload.needs_seeding);
      })
      .catch((err) => {
        setErrorMsg(err.response?.data?.error || 'Failed to load questions.');
      })
      .finally(() => setLoading(false));
  };

  // Educator/admin: generate 30 fresh questions tagged to *this student's* set,
  // so a follow-up fetch by the same admin sees them immediately.
  const generateQuestions = () => {
    if (!company || !topic) return;
    setGenerating(true);
    setErrorMsg('');
    const body = { count: 30 };
    if (setNumber) body.set = setNumber;
    api.post(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${encodeURIComponent(topic)}/questions/generate`, body)
      .then(() => fetchQuestions())
      .catch((err) => {
        setErrorMsg(err.response?.data?.error || 'Failed to generate questions.');
      })
      .finally(() => setGenerating(false));
  };

  // Educator/admin: pre-seed all 5 sets (150 questions). Long-running.
  const generateAllSets = () => {
    if (!company || !topic || generatingAll) return;
    setGeneratingAll(true);
    setGenerateAllReport(null);
    setErrorMsg('');
    api.post(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${encodeURIComponent(topic)}/questions/generate-all-sets`, { count_per_set: 30 })
      .then((res) => {
        setGenerateAllReport(res.data?.data || null);
        return fetchQuestions();
      })
      .catch((err) => {
        setErrorMsg(err.response?.data?.error || 'Failed to generate all sets.');
      })
      .finally(() => setGeneratingAll(false));
  };

  // ── PYQ seed flow ───────────────────────────────────────────────
  const stopPolling = () => {
    if (seedPollRef.current) {
      clearInterval(seedPollRef.current);
      seedPollRef.current = null;
    }
  };

  const fetchTopicStats = async () => {
    if (!company || !topic) return;
    try {
      const res = await api.get(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${encodeURIComponent(topic)}/stats`);
      setTopicStats(res.data?.data || null);
    } catch (err) {
      console.warn('topic stats fetch failed:', err.message);
    }
  };

  const pollSeedJob = (jobId) => {
    stopPolling();
    seedPollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/admin/company-prep/pyq/jobs/${jobId}`);
        const job = res.data?.data;
        if (!job) return;
        // Bail out of the re-render if the polled job is byte-for-byte
        // unchanged from the last tick. Without this, every poll forces
        // a full subtree re-render even when the agent is idle.
        setSeedJob((prev) => {
          if (
            prev
            && prev.status === job.status
            && prev.inserted === job.inserted
            && prev.attempted === job.attempted
            && (Array.isArray(prev.log) ? prev.log.length : 0) === (Array.isArray(job.log) ? job.log.length : 0)
            && (prev.error || null) === (job.error || null)
          ) {
            return prev;
          }
          return job;
        });
        if (['succeeded', 'partial', 'failed', 'cancelled'].includes(job.status)) {
          stopPolling();
          setSeeding(false);
          fetchQuestions();
          fetchTopicStats(); // refresh existing count
        }
      } catch (err) {
        // Transient error — keep polling.
        console.warn('PYQ poll failed:', err.message);
      }
    }, 2500);
  };

  const startSeed = async () => {
    if (!company || !topic || seeding) return;
    if (!seedYears.length) {
      setErrorMsg('Pick at least one year.');
      return;
    }
    const gap = Math.max(0, seedTarget - (topicStats?.total || 0));
    if (gap === 0) {
      setErrorMsg(`Already have ${topicStats?.total || 0} questions for this topic. Bump the target above ${topicStats?.total || 0} to generate more.`);
      return;
    }
    setSeeding(true);
    setErrorMsg('');
    setSeedJob(null);
    setSeedStartGap(gap);
    try {
      const res = await api.post('/admin/company-prep/pyq/seed', {
        company: company.name,
        topic,
        years: seedYears,
        target_count: seedTarget,
      });
      const jobId = res.data?.data?.job_id;
      if (jobId) {
        setSeedJob({ id: jobId, status: 'queued', inserted: 0, attempted: 0, log: [], target_count: seedTarget });
        pollSeedJob(jobId);
      } else {
        setSeeding(false);
        setErrorMsg('Failed to start seed job.');
      }
    } catch (err) {
      setSeeding(false);
      setErrorMsg(err.response?.data?.error || 'Failed to start seed job.');
    }
  };

  const cancelSeed = async () => {
    if (!seedJob?.id) return;
    try {
      await api.post(`/admin/company-prep/pyq/jobs/${seedJob.id}/cancel`);
    } catch (err) {
      console.warn('Cancel failed:', err.message);
    }
  };

  const toggleSeedYear = (year) => {
    setSeedYears((prev) => (prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year].sort((a, b) => b - a)));
  };

  const openSeedModal = () => {
    setSeedJob(null);
    setSeedModalOpen(true);
    fetchTopicStats();
  };

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, index, topicIdx]);

  useEffect(() => () => stopPolling(), []);

  if (!company || !round || !topic) {
    return (
      <PageTransition>
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
          <h2 style={{ font: '600 1.2rem/1 var(--font-display)', color: 'var(--text-primary)', marginBottom: 12 }}>
            Topic not found
          </h2>
          <button className="btn btn-ghost" onClick={() => navigate('/company-prep')}>
            <HiOutlineArrowLeft size={16} /> Back to companies
          </button>
        </div>
      </PageTransition>
    );
  }

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  const submit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: questions.map((q) => ({
          question_id: q.id,
          selected_option: answers[q.id],
        })),
      };
      const res = await api.post('/company-prep/practice/grade', payload);
      setResults(res.data?.data || null);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to grade answers.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setAnswers({});
    setResults(null);
  };

  const getResultFor = (qid) => results?.results?.find((r) => r.question_id === qid);

  return (
    <PageTransition>
      <button
        type="button"
        onClick={() => navigate(`/company-prep/${company.slug}/rounds/${roundIndex}`)}
        className="btn btn-ghost"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 16, padding: '6px 12px',
          font: '500 0.85rem/1 var(--font-body)',
        }}
      >
        <HiOutlineArrowLeft size={16} />
        Back to round
      </button>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ font: '500 0.74rem/1 var(--font-body)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Practice · {company.name} · {round.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ font: '700 1.6rem/1.2 var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
            {topic}
          </h1>
          {setNumber && pyqCount === 0 && (
            <span
              title="Each student is assigned one of 5 question sets so different students see different questions."
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999,
                background: `${color}18`,
                border: `1px solid ${color}55`,
                color,
                font: '600 0.72rem/1 var(--font-body)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Set {setNumber} of {totalSets}
            </span>
          )}
          {pyqCount > 0 && (
            <span
              title="This pool is curated placement-style practice — past-year + AI-generated."
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999,
                background: 'rgba(99,102,241,0.14)',
                border: '1px solid rgba(99,102,241,0.45)',
                color: '#a5b4fc',
                font: '600 0.72rem/1 var(--font-body)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              <HiOutlineClock size={12} /> {pyqCount} curated · {aiCount} AI
            </span>
          )}
        </div>
        <p style={{ font: '400 0.85rem/1.4 var(--font-body)', color: 'var(--text-muted)', margin: '6px 0 0' }}>
          Answer all questions, then submit for instant feedback with explanations.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="glass-card-static" style={{ padding: 40, textAlign: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
            style={{ display: 'inline-block', marginBottom: 12 }}
          >
            <HiOutlineSparkles size={28} style={{ color }} />
          </motion.div>
          <div style={{ font: '500 0.9rem/1.3 var(--font-body)', color: 'var(--text-muted)' }}>
            Loading questions…
          </div>
        </div>
      )}

      {/* No questions in bank */}
      {!loading && questions.length === 0 && !errorMsg && (
        <div className="glass-card-static" style={{ padding: 32, textAlign: 'center' }}>
          <HiOutlineSparkles size={32} style={{ color, marginBottom: 8 }} />
          <div style={{ font: '600 1rem/1.3 var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
            {canGenerate ? 'No practice questions yet' : 'Practice questions not available yet'}
          </div>
          <div style={{ font: '400 0.85rem/1.5 var(--font-body)', color: 'var(--text-muted)', marginBottom: 16, maxWidth: 520, margin: '0 auto 16px' }}>
            {canGenerate
              ? `Generate placement-style MCQs for ${company.name} — ${topic} with the LLM agent, or fall back to AI-generated practice across ${totalSets} sets.`
              : 'Your educator hasn’t added practice questions for this topic yet. Please check back later or contact them.'}
          </div>
          {canGenerate && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={openSeedModal}
                disabled={generating || generatingAll || seeding}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg, #34d399, #10b981)',
                  border: 'none',
                  font: '600 0.88rem/1 var(--font-body)',
                  opacity: (generating || generatingAll || seeding) ? 0.6 : 1,
                }}
              >
                <HiOutlineGlobeAlt size={14} />
                Seed past-year questions
              </button>
              <button
                type="button"
                onClick={generateAllSets}
                disabled={generating || generatingAll || seeding}
                className="btn btn-ghost"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px',
                  font: '600 0.88rem/1 var(--font-body)',
                  opacity: (generating || generatingAll || seeding) ? 0.6 : 1,
                }}
              >
                <motion.span
                  animate={generatingAll ? { rotate: 360 } : { rotate: 0 }}
                  transition={generatingAll ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : { duration: 0.2 }}
                  style={{ display: 'inline-flex' }}
                >
                  <HiOutlineSparkles size={14} />
                </motion.span>
                {generatingAll ? `Seeding all ${totalSets} sets…` : `AI-generate all ${totalSets} sets`}
              </button>
              <button
                type="button"
                onClick={generateQuestions}
                disabled={generating || generatingAll || seeding}
                className="btn btn-ghost"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px',
                  font: '600 0.88rem/1 var(--font-body)',
                  opacity: (generating || generatingAll || seeding) ? 0.6 : 1,
                }}
              >
                <motion.span
                  animate={generating ? { rotate: 360 } : { rotate: 0 }}
                  transition={generating ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : { duration: 0.2 }}
                  style={{ display: 'inline-flex' }}
                >
                  <HiOutlineArrowPath size={14} />
                </motion.span>
                {generating ? 'Generating…' : `Seed only my set${setNumber ? ` (Set ${setNumber})` : ''}`}
              </button>
            </div>
          )}
          {generateAllReport && (
            <div style={{ marginTop: 18, font: '400 0.78rem/1.5 var(--font-body)', color: 'var(--text-muted)' }}>
              {Object.entries(generateAllReport.seeded_now || {}).length > 0 && (
                <div>Seeded now: {Object.entries(generateAllReport.seeded_now).map(([s, n]) => `Set ${s}: ${n}`).join(' · ')}</div>
              )}
              {generateAllReport.already_full?.length > 0 && (
                <div>Already full: Set {generateAllReport.already_full.join(', ')}</div>
              )}
              {generateAllReport.failures?.length > 0 && (
                <div style={{ color: '#fca5a5' }}>Failed: {generateAllReport.failures.map((f) => `Set ${f.set} (${f.error})`).join(' · ')}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {!loading && errorMsg && questions.length === 0 && (
        <div className="glass-card-static" style={{ padding: 22, textAlign: 'center', border: '1px solid rgba(248,113,113,0.35)' }}>
          <div style={{ color: '#fca5a5', font: '500 0.9rem/1.4 var(--font-body)', marginBottom: 12 }}>{errorMsg}</div>
          <button onClick={fetchQuestions} className="btn btn-ghost"><HiOutlineArrowPath size={14} style={{ marginRight: 6 }} /> Try again</button>
        </div>
      )}

      {/* Questions list */}
      {!loading && questions.length > 0 && (
        <>
          {/* needs_seeding banner — only when we returned <30 and admin can act on it */}
          {needsSeeding && !results && (
            <div
              className="glass-card-static"
              style={{
                padding: '12px 16px',
                marginBottom: 14,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(99,102,241,0.04))',
                border: '1px solid rgba(99,102,241,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <HiOutlineGlobeAlt size={20} style={{ color: '#a5b4fc' }} />
                <div style={{ font: '500 0.86rem/1.4 var(--font-body)', color: 'var(--text-secondary)' }}>
                  We're still building the company-style question bank for this topic. You're seeing AI-generated practice in the meantime.
                </div>
              </div>
              {canGenerate && (
                <button
                  type="button"
                  onClick={openSeedModal}
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', font: '600 0.78rem/1 var(--font-body)', borderColor: 'rgba(99,102,241,0.4)' }}
                  disabled={seeding}
                >
                  <HiOutlineGlobeAlt size={14} style={{ marginRight: 6 }} />
                  Seed past-year questions
                </button>
              )}
            </div>
          )}

          {/* Score banner after grading */}
          {results && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card-static"
              style={{
                padding: 18,
                marginBottom: 18,
                background: results.percentage >= 60
                  ? 'linear-gradient(135deg, rgba(52,211,153,0.18), rgba(52,211,153,0.04))'
                  : 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(251,191,36,0.04))',
                border: `1px solid ${results.percentage >= 60 ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.4)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ font: '700 1.1rem/1 var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>
                  You scored {results.correct} / {results.total}
                </div>
                <div style={{ font: '500 0.84rem/1.3 var(--font-body)', color: 'var(--text-muted)' }}>
                  {results.percentage}% — {results.percentage >= 80 ? 'Excellent!' : results.percentage >= 60 ? 'Good — keep practicing.' : 'Review the explanations below and try again.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={reset} className="btn btn-ghost" style={{ padding: '8px 14px' }}>
                  <HiOutlineArrowPath size={14} style={{ marginRight: 6 }} /> Retry
                </button>
                <button
                  onClick={() => navigate(`/company-prep/${company.slug}/rounds/${roundIndex}/topics/${topicIdx}/learn`)}
                  className="btn btn-ghost"
                  style={{ padding: '8px 14px' }}
                >
                  <HiOutlineBookOpen size={14} style={{ marginRight: 6 }} /> Review notes
                </button>
              </div>
            </motion.div>
          )}

          {questions.map((q, qi) => {
            const r = getResultFor(q.id);
            const selected = answers[q.id];
            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: qi * 0.05 }}
                className="glass-card-static"
                style={{ padding: 22, marginBottom: 14 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${color}1a`, border: `1px solid ${color}40`, color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    font: '700 0.78rem/1 var(--font-display)',
                  }}>
                    {qi + 1}
                  </div>
                  <div style={{ font: '600 0.95rem/1.4 var(--font-body)', color: 'var(--text-primary)', flex: 1 }}>
                    {q.question_text}
                  </div>
                  {q.source === 'past-year-llm' && (
                    <span
                      title={`Sourced from real ${q.year_source || 'past-year'} placement test material.`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(52,211,153,0.14)',
                        border: '1px solid rgba(52,211,153,0.4)',
                        color: '#34d399',
                        font: '600 0.66rem/1 var(--font-body)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <HiOutlineClock size={11} /> Past Year{q.year_source ? ` ${q.year_source}` : ''}
                    </span>
                  )}
                  {q.source === 'placement-style-llm' && (
                    <span
                      title={`LLM-generated MCQ in ${company.name}'s typical placement-test pattern${q.year_source ? ` for ${q.year_source}` : ''}.`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(99,102,241,0.14)',
                        border: '1px solid rgba(99,102,241,0.45)',
                        color: '#a5b4fc',
                        font: '600 0.66rem/1 var(--font-body)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <HiOutlineClock size={11} /> Company-style{q.year_source ? ` ${q.year_source}` : ''}
                    </span>
                  )}
                  {q.source === 'ai-generated' && (
                    <span
                      title="AI-generated practice question."
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: 'var(--text-muted)',
                        font: '600 0.66rem/1 var(--font-body)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <HiOutlineCpuChip size={11} /> AI
                    </span>
                  )}
                  {r && (
                    r.is_correct
                      ? <HiOutlineCheckCircle size={22} style={{ color: '#34d399' }} />
                      : <HiOutlineXCircle size={22} style={{ color: '#f87171' }} />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {q.options.map((opt, oi) => {
                    const isSelected = selected === opt;
                    const isCorrectOpt = r && (
                      String(r.correct_answer).trim().toLowerCase() === String(opt).trim().toLowerCase()
                    );
                    const showResult = !!r;
                    let bg = 'rgba(255,255,255,0.03)';
                    let border = 'rgba(255,255,255,0.08)';
                    let textColor = 'var(--text-secondary)';
                    if (showResult && isCorrectOpt) {
                      bg = 'rgba(52,211,153,0.12)';
                      border = 'rgba(52,211,153,0.4)';
                      textColor = '#34d399';
                    } else if (showResult && isSelected && !r.is_correct) {
                      bg = 'rgba(248,113,113,0.12)';
                      border = 'rgba(248,113,113,0.4)';
                      textColor = '#f87171';
                    } else if (!showResult && isSelected) {
                      bg = `${color}18`;
                      border = `${color}55`;
                      textColor = 'var(--text-primary)';
                    }
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={!!r}
                        onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                        style={{
                          textAlign: 'left',
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: bg,
                          border: `1px solid ${border}`,
                          color: textColor,
                          cursor: r ? 'default' : 'pointer',
                          font: '500 0.88rem/1.4 var(--font-body)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {r && r.explanation && (
                  <div style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    font: '400 0.83rem/1.5 var(--font-body)',
                    color: 'var(--text-secondary)',
                  }}>
                    <strong style={{ color: '#a5b4fc' }}>Explanation: </strong>
                    {r.explanation}
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Submit */}
          {!results && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
              <button
                type="button"
                onClick={submit}
                disabled={!allAnswered || submitting}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px',
                  background: allAnswered ? `linear-gradient(135deg, ${color}, ${color}cc)` : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: allAnswered ? '#fff' : 'var(--text-muted)',
                  cursor: allAnswered ? 'pointer' : 'not-allowed',
                  font: '600 0.9rem/1 var(--font-body)',
                }}
              >
                <HiOutlineCheckCircle size={18} />
                {submitting ? 'Grading…' : allAnswered ? 'Submit answers' : `Answer all ${questions.length} questions`}
              </button>
            </div>
          )}
        </>
      )}

      {/* PYQ seeding modal — admin only */}
      <AnimatePresence>
        {seedModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !seeding && setSeedModalOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card-static"
              style={{ width: '100%', maxWidth: 540, padding: 24, borderRadius: 16 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <HiOutlineGlobeAlt size={22} style={{ color: '#34d399' }} />
                  <h3 style={{ font: '700 1.05rem/1 var(--font-display)', color: 'var(--text-primary)', margin: 0 }}>
                    Seed past-year questions
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !seeding && setSeedModalOpen(false)}
                  disabled={seeding}
                  className="btn btn-ghost"
                  style={{ padding: 6 }}
                >
                  <HiOutlineXMark size={18} />
                </button>
              </div>

              <p style={{ font: '400 0.86rem/1.45 var(--font-body)', color: 'var(--text-muted)', margin: '0 0 14px' }}>
                The LLM agent will craft placement-style MCQs that match {company.name}'s typical <strong>{topic}</strong> pattern for the selected years and add them to the question bank.
              </p>

              {/* Topic stats — current pool size */}
              <div style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                font: '500 0.82rem/1.4 var(--font-body)',
                color: 'var(--text-secondary)',
              }}>
                {topicStats == null ? (
                  <span style={{ color: 'var(--text-muted)' }}>Loading current count…</span>
                ) : (
                  <>
                    <strong style={{ color: 'var(--text-primary)' }}>{topicStats.total}</strong> question{topicStats.total === 1 ? '' : 's'} in the bank for this topic.
                    {' '}
                    {(() => {
                      const gap = Math.max(0, seedTarget - topicStats.total);
                      if (gap === 0) {
                        return <span style={{ color: '#34d399' }}>Target met — bump the count above {topicStats.total} to generate more.</span>;
                      }
                      return <>Will generate <strong style={{ color: '#a5b4fc' }}>{gap}</strong> new question{gap === 1 ? '' : 's'} across the picked years to reach <strong>{seedTarget}</strong>.</>;
                    })()}
                  </>
                )}
              </div>

              {/* Year picker */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ font: '600 0.78rem/1 var(--font-body)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Years
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PYQ_YEAR_OPTIONS.map((year) => {
                    const active = seedYears.includes(year);
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => !seeding && toggleSeedYear(year)}
                        disabled={seeding}
                        style={{
                          padding: '6px 14px', borderRadius: 999,
                          background: active ? 'rgba(52,211,153,0.14)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${active ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          color: active ? '#34d399' : 'var(--text-muted)',
                          font: '600 0.82rem/1 var(--font-body)',
                          cursor: seeding ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target count (top-up target) */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ font: '600 0.78rem/1 var(--font-body)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Total questions to have for this topic
                </div>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={seedTarget}
                  onChange={(e) => setSeedTarget(Math.min(200, Math.max(1, Number(e.target.value) || 30)))}
                  disabled={seeding}
                  style={{
                    width: 100, padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)',
                    font: '500 0.9rem/1 var(--font-body)',
                  }}
                />
                <span style={{ marginLeft: 10, font: '400 0.78rem/1 var(--font-body)', color: 'var(--text-muted)' }}>
                  total in the bank after this run
                </span>
              </div>

              {/* Job progress */}
              {seedJob && (() => {
                const denom = Math.max(1, seedStartGap || seedJob.target_count || seedTarget);
                const inserted = seedJob.inserted ?? 0;
                const pct = Math.min(100, (inserted / denom) * 100);
                const isTerminal = ['succeeded', 'partial', 'failed', 'cancelled'].includes(seedJob.status);
                const statusColor =
                  seedJob.status === 'succeeded' ? '#34d399'
                  : seedJob.status === 'failed' ? '#fca5a5'
                  : seedJob.status === 'partial' ? '#fbbf24'
                  : seedJob.status === 'cancelled' ? 'var(--text-muted)'
                  : '#a5b4fc';
                return (
                  <div
                    style={{
                      padding: 14, borderRadius: 10, marginBottom: 14,
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <motion.span
                          animate={!isTerminal ? { rotate: 360 } : { rotate: 0 }}
                          transition={!isTerminal ? { repeat: Infinity, duration: 1.4, ease: 'linear' } : { duration: 0.2 }}
                          style={{ display: 'inline-flex' }}
                        >
                          <HiOutlineCpuChip size={16} style={{ color: statusColor }} />
                        </motion.span>
                        <span style={{ font: '600 0.86rem/1 var(--font-body)', color: statusColor, textTransform: 'capitalize' }}>
                          {seedJob.status}
                        </span>
                      </div>
                      <span style={{ font: '500 0.78rem/1 var(--font-body)', color: 'var(--text-muted)' }}>
                        {inserted} / {denom} inserted · {seedJob.attempted ?? 0} attempted
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                      <motion.div
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4 }}
                        style={{ height: '100%', background: 'linear-gradient(90deg, #34d399, #10b981)' }}
                      />
                    </div>
                    {/* Latest log line */}
                    {Array.isArray(seedJob.log) && seedJob.log.length > 0 && (
                      <div style={{ font: '400 0.74rem/1.4 var(--font-body)', color: 'var(--text-muted)' }}>
                        {seedJob.log[seedJob.log.length - 1].message}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Error surface — separate red panel so the message is unmissable */}
              {seedJob?.error && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  marginBottom: 14,
                  background: 'rgba(248,113,113,0.10)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  color: '#fca5a5',
                  font: '500 0.82rem/1.45 var(--font-body)',
                }}>
                  <div style={{ font: '700 0.74rem/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, opacity: 0.9 }}>
                    Error
                  </div>
                  {seedJob.error}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                {seeding ? (
                  <button
                    type="button"
                    onClick={cancelSeed}
                    className="btn btn-ghost"
                    style={{ padding: '10px 18px', font: '600 0.86rem/1 var(--font-body)' }}
                  >
                    Cancel
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setSeedModalOpen(false)}
                      className="btn btn-ghost"
                      style={{ padding: '10px 18px', font: '600 0.86rem/1 var(--font-body)' }}
                    >
                      Close
                    </button>
                    {(() => {
                      const gap = topicStats == null ? null : Math.max(0, seedTarget - (topicStats?.total || 0));
                      const disabled = seedYears.length === 0 || gap === 0;
                      return (
                        <button
                          type="button"
                          onClick={startSeed}
                          disabled={disabled}
                          className="btn btn-primary"
                          style={{
                            padding: '10px 18px',
                            background: 'linear-gradient(135deg, #34d399, #10b981)',
                            border: 'none',
                            font: '600 0.86rem/1 var(--font-body)',
                            opacity: disabled ? 0.5 : 1,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                          }}
                          title={gap === 0 ? `Already have ${topicStats?.total ?? 0} questions. Bump target above ${topicStats?.total ?? 0}.` : ''}
                        >
                          <HiOutlineGlobeAlt size={14} style={{ marginRight: 6 }} />
                          {seedJob && ['succeeded', 'partial', 'failed', 'cancelled'].includes(seedJob.status)
                            ? 'Run again'
                            : (gap === 0 ? 'Already full' : `Generate ${gap ?? '…'} new`)}
                        </button>
                      );
                    })()}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
