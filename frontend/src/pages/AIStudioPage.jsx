import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineSparkles, HiOutlineAcademicCap, HiOutlineClipboardDocumentCheck,
  HiOutlineShieldExclamation, HiOutlineLightBulb, HiOutlineDocumentText,
  HiOutlineArrowPath, HiOutlineBookmarkSquare,
} from 'react-icons/hi2';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import api from '../lib/api';
import useUiStore from '../store/uiStore';
import useAuthStore from '../store/authStore';

const TOOLS = [
  {
    id: 'quiz',
    label: 'Quiz Generator',
    Icon: HiOutlineSparkles,
    blurb: 'Turn any text into MCQs',
    accent: '#ff7a00',
  },
  {
    id: 'course',
    label: 'Course Builder',
    Icon: HiOutlineAcademicCap,
    blurb: 'Outline a course from a subject',
    accent: '#ffb400',
  },
  {
    id: 'grade',
    label: 'Assignment Grader',
    Icon: HiOutlineClipboardDocumentCheck,
    blurb: 'Score work against a rubric',
    accent: '#34d399',
  },
  {
    id: 'plagiarism',
    label: 'Originality Check',
    Icon: HiOutlineShieldExclamation,
    blurb: 'Detect plagiarism / AI text',
    accent: '#fb7185',
  },
  {
    id: 'recommend',
    label: 'Next-Step Recommender',
    Icon: HiOutlineLightBulb,
    blurb: 'Personalised learning path',
    accent: '#a78bfa',
  },
  {
    id: 'summarize',
    label: 'Summarizer',
    Icon: HiOutlineDocumentText,
    blurb: 'Bullet-point any lesson',
    accent: '#22d3ee',
  },
];

export default function AIStudioPage() {
  const [active, setActive] = useState('quiz');
  const addToast = useUiStore((s) => s.addToast);
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'admin' || user?.role === 'teacher';

  return (
    <div className="page-content ai-studio">
      <header className="ai-studio-header">
        <div>
          <div className="ai-studio-eyebrow">
            <HiOutlineSparkles size={14} />
            <span>Powered by Ollama · qwen2.5</span>
          </div>
          <h1 className="ai-studio-title">AI Studio</h1>
          <p className="ai-studio-sub">Six agents, one workspace. Generate, grade, and recommend without leaving the page.</p>
        </div>
      </header>

      <div className="ai-studio-grid">
        {/* Tool rail */}
        <aside className="ai-tool-rail">
          {TOOLS.map((t) => {
            const Icon = t.Icon;
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                className={`ai-tool-tile ${isActive ? 'active' : ''}`}
                onClick={() => setActive(t.id)}
                style={isActive ? { '--accent': t.accent } : { '--accent': t.accent }}
              >
                <span className="ai-tool-icon" style={{ background: `${t.accent}1a`, color: t.accent }}>
                  <Icon size={20} />
                </span>
                <span className="ai-tool-meta">
                  <span className="ai-tool-label">{t.label}</span>
                  <span className="ai-tool-blurb">{t.blurb}</span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* Workspace */}
        <section className="ai-workspace glass-card-static">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {active === 'quiz'       && <QuizTool addToast={addToast} />}
              {active === 'course'     && <CourseTool addToast={addToast} canSave={isStaff} />}
              {active === 'grade'      && <GradeTool addToast={addToast} />}
              {active === 'plagiarism' && <PlagiarismTool addToast={addToast} />}
              {active === 'recommend'  && <RecommendTool addToast={addToast} />}
              {active === 'summarize'  && <SummarizeTool addToast={addToast} />}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────── Shared bits ─────────────────────────── */

function ToolHead({ title, description }) {
  return (
    <div className="ai-tool-head">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function RunButton({ loading, disabled, onClick, label, loadingLabel }) {
  return (
    <Button variant="primary" size="lg" onClick={onClick} disabled={disabled || loading} style={{ width: '100%' }}>
      {loading ? (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <span className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          {loadingLabel || 'Working…'}
        </span>
      ) : (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <HiOutlineSparkles size={18} /> {label}
        </span>
      )}
    </Button>
  );
}

function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="ai-error">
      <strong>Failed:</strong> {error}
      <button className="admin-icon-btn" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}

function ResultPanel({ children, title }) {
  return (
    <div className="ai-result">
      {title && <div className="ai-result-title">{title}</div>}
      {children}
    </div>
  );
}

async function callAI(path, body) {
  try {
    const res = await api.post(path, body);
    return { data: res.data.data, error: null };
  } catch (err) {
    return { data: null, error: err.response?.data?.error || err.message || 'Request failed' };
  }
}

/* ─────────────────────────── Quiz Generator ─────────────────────────── */

function QuizTool({ addToast }) {
  const [content, setContent] = useState('');
  const [num, setNum] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    if (content.trim().length < 50) { addToast('Provide at least 50 characters', 'error'); return; }
    setLoading(true); setError(null); setResult(null);
    const { data, error: err } = await callAI('/ai/generate-quiz', { content, num_questions: num });
    setLoading(false);
    if (err) { setError(err); return; }
    setResult(data.questions || []);
    addToast(`Generated ${data.questions?.length || 0} questions`, 'success');
  };

  return (
    <>
      <ToolHead title="Quiz Generator" description="Paste lesson content. The agent returns multiple-choice questions with answers and explanations." />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <label className="input-label">Source content</label>
      <textarea
        className="admin-textarea"
        rows={8}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste a lesson, article, or notes (min 50 characters)…"
      />
      <div className="ai-meta-row">
        <span>{content.length} characters</span>
      </div>

      <div className="ai-form-row">
        <div>
          <label className="input-label">Number of questions</label>
          <input
            type="number"
            min={1}
            max={20}
            value={num}
            onChange={(e) => setNum(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="admin-select"
          />
        </div>
      </div>

      <RunButton loading={loading} onClick={run} label={`Generate ${num} Questions`} loadingLabel={`Generating ${num} questions…`} />

      {result && result.length > 0 && (
        <ResultPanel title={`${result.length} questions ready`}>
          <ol className="ai-quiz-list">
            {result.map((q, i) => (
              <li key={i}>
                <div className="ai-quiz-q">{q.question || q.question_text}</div>
                {q.options && (
                  <ul className="ai-quiz-opts">
                    {q.options.map((opt, j) => {
                      const correctIdx = typeof q.correct_answer === 'string'
                        ? ['A', 'B', 'C', 'D'].indexOf(q.correct_answer.charAt(0).toUpperCase())
                        : (q.correct ?? 0);
                      const isCorrect = j === correctIdx;
                      return (
                        <li key={j} className={isCorrect ? 'correct' : ''}>
                          {opt}{isCorrect && <Badge variant="success">correct</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {q.explanation && <div className="ai-quiz-expl">💡 {q.explanation}</div>}
              </li>
            ))}
          </ol>
        </ResultPanel>
      )}
    </>
  );
}

/* ─────────────────────────── Course Builder ─────────────────────────── */

function CourseTool({ addToast, canSave }) {
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [num, setNum] = useState(6);
  const [save, setSave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [outline, setOutline] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!subject.trim()) { addToast('Subject is required', 'error'); return; }
    setLoading(true); setError(null); setOutline(null);
    const { data, error: err } = await callAI('/ai/generate-course', {
      subject, difficulty, num_lessons: num, save: save && canSave,
    });
    setLoading(false);
    if (err) { setError(err); return; }
    setOutline(data.outline || data);
    addToast(save && canSave ? 'Course saved as draft' : 'Outline generated', 'success');
  };

  return (
    <>
      <ToolHead title="Course Builder" description="Describe a subject and the agent produces a full course outline — title, description, and a sequence of lessons." />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <Input label="Subject" placeholder="e.g. Intro to React Hooks" value={subject} onChange={(e) => setSubject(e.target.value)} />

      <div className="ai-form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label className="input-label">Difficulty</label>
          <select className="admin-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <label className="input-label">Lessons</label>
          <input type="number" min={3} max={15} value={num} onChange={(e) => setNum(Math.max(3, Math.min(15, parseInt(e.target.value) || 3)))} className="admin-select" />
        </div>
      </div>

      {canSave && (
        <label className="ai-checkbox">
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
          <span>Save as draft course (unpublished)</span>
        </label>
      )}

      <RunButton loading={loading} onClick={run} label="Generate Course Outline" loadingLabel="Designing course…" />

      {outline && (
        <ResultPanel title={outline.title}>
          {outline.description && <p className="ai-course-desc">{outline.description}</p>}
          <div className="ai-course-meta">
            {outline.category && <Badge variant="primary">{outline.category}</Badge>}
            {outline.difficulty && <Badge variant="warning">{outline.difficulty}</Badge>}
            {outline.lessons && <Badge variant="info">{outline.lessons.length} lessons</Badge>}
          </div>
          {outline.lessons && (
            <ol className="ai-lesson-list">
              {outline.lessons.map((l, i) => (
                <li key={i}>
                  <strong>{l.title}</strong>
                  {l.duration_minutes && <span className="text-muted"> · {l.duration_minutes} min</span>}
                  {l.description && <div className="text-muted">{l.description}</div>}
                </li>
              ))}
            </ol>
          )}
        </ResultPanel>
      )}
    </>
  );
}

/* ─────────────────────────── Grader ─────────────────────────── */

function GradeTool({ addToast }) {
  const [text, setText] = useState('');
  const [rubric, setRubric] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!text.trim()) { addToast('Assignment text is required', 'error'); return; }
    setLoading(true); setError(null); setResult(null);
    const { data, error: err } = await callAI('/ai/grade-assignment', { assignment_text: text, rubric });
    setLoading(false);
    if (err) { setError(err); return; }
    setResult(data);
    addToast('Graded', 'success');
  };

  return (
    <>
      <ToolHead title="Assignment Grader" description="Provide the student work and an optional rubric. The agent returns a score, strengths, and improvement notes." />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <label className="input-label">Assignment text</label>
      <textarea className="admin-textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the student submission…" />

      <label className="input-label" style={{ marginTop: 12 }}>Rubric (optional)</label>
      <textarea className="admin-textarea" rows={4} value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder="e.g. 40% clarity, 30% accuracy, 30% structure" />

      <RunButton loading={loading} onClick={run} label="Grade Assignment" loadingLabel="Grading…" />

      {result && (
        <ResultPanel title="Grading result">
          <pre className="ai-pre">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
        </ResultPanel>
      )}
    </>
  );
}

/* ─────────────────────────── Plagiarism ─────────────────────────── */

function PlagiarismTool({ addToast }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    if (text.trim().length < 80) { addToast('Provide at least 80 characters', 'error'); return; }
    setLoading(true); setError(null); setResult(null);
    const { data, error: err } = await callAI('/ai/check-plagiarism', { text });
    setLoading(false);
    if (err) { setError(err); return; }
    setResult(data);
    addToast('Analysis complete', 'success');
  };

  return (
    <>
      <ToolHead title="Originality Check" description="Spot signs of plagiarism, AI generation, or unusual writing patterns in submitted work." />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <label className="input-label">Text to analyse</label>
      <textarea className="admin-textarea" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the suspect text (min 80 characters)…" />
      <div className="ai-meta-row"><span>{text.length} characters</span></div>

      <RunButton loading={loading} onClick={run} label="Check Originality" loadingLabel="Analysing…" />

      {result && (
        <ResultPanel title="Originality report">
          <pre className="ai-pre">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
        </ResultPanel>
      )}
    </>
  );
}

/* ─────────────────────────── Recommender ─────────────────────────── */

function RecommendTool({ addToast }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    const { data, error: err } = await callAI('/ai/recommend-lessons', {});
    setLoading(false);
    if (err) { setError(err); return; }
    setResult(data);
    addToast('Recommendations ready', 'success');
  };

  return (
    <>
      <ToolHead title="Next-Step Recommender" description="Uses your completed lessons to suggest what to study next. No input needed — just hit Generate." />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <RunButton loading={loading} onClick={run} label="Recommend Next Lessons" loadingLabel="Thinking…" />

      {result && (
        <ResultPanel title="Suggested path">
          <pre className="ai-pre">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
        </ResultPanel>
      )}
    </>
  );
}

/* ─────────────────────────── Summarizer ─────────────────────────── */

function SummarizeTool({ addToast }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const summaryRef = useRef(null);

  const run = async () => {
    if (content.trim().length < 100) { addToast('Provide at least 100 characters', 'error'); return; }
    setLoading(true); setError(null); setResult(null);
    const { data, error: err } = await callAI('/ai/summarize', { content });
    setLoading(false);
    if (err) { setError(err); return; }
    setResult(data);
    addToast('Summary ready', 'success');
    setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const copy = () => {
    if (!result) return;
    const text = typeof result === 'string' ? result : (result.summary || JSON.stringify(result));
    navigator.clipboard.writeText(text);
    addToast('Copied to clipboard', 'success');
  };

  return (
    <>
      <ToolHead title="Content Summarizer" description="Distil long lessons into bullet points students can scan in 30 seconds." />
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <label className="input-label">Lesson content</label>
      <textarea className="admin-textarea" rows={10} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste the full lesson text (min 100 characters)…" />
      <div className="ai-meta-row"><span>{content.length} characters</span></div>

      <RunButton loading={loading} onClick={run} label="Summarize" loadingLabel="Summarizing…" />

      {result && (
        <div ref={summaryRef}>
          <ResultPanel title="Summary">
            <pre className="ai-pre">{typeof result === 'string' ? result : (result.summary || JSON.stringify(result, null, 2))}</pre>
            <Button variant="ghost" size="sm" onClick={copy} style={{ marginTop: 12 }}>
              <HiOutlineBookmarkSquare size={14} /> Copy
            </Button>
          </ResultPanel>
        </div>
      )}
    </>
  );
}
