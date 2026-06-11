import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageTransition from '../../components/layout/PageTransition';
import useAuthStore from '../../store/authStore';
import { getLSRWProgress, getLSRWRecent } from '../../lib/lsrwApi';
import {
  HiOutlineSpeakerWave, HiOutlineMicrophone, HiOutlineBookOpen,
  HiOutlinePencilSquare, HiOutlineArrowRight, HiOutlineClock,
  HiOutlineTrophy, HiOutlineChartBar,
} from 'react-icons/hi2';

const SKILLS = [
  {
    key: 'listening',
    label: 'Listening',
    emoji: '🎧',
    icon: HiOutlineSpeakerWave,
    path: '/lsrw/listening',
    color: '#3b82f6',
    desc: 'Listen to passages and answer comprehension questions',
    tip: 'Audio plays via browser text-to-speech',
  },
  {
    key: 'speaking',
    label: 'Speaking',
    emoji: '🎙️',
    icon: HiOutlineMicrophone,
    path: '/lsrw/speaking',
    color: '#a855f7',
    desc: 'Speak on a topic — AI scores pronunciation, fluency & grammar',
    tip: 'Microphone access required',
  },
  {
    key: 'reading',
    label: 'Reading',
    emoji: '📖',
    icon: HiOutlineBookOpen,
    path: '/lsrw/reading',
    color: '#10b981',
    desc: 'Read passages and test comprehension & inference',
    tip: 'Camera activates for engagement tracking',
  },
  {
    key: 'writing',
    label: 'Writing',
    emoji: '✍️',
    icon: HiOutlinePencilSquare,
    path: '/lsrw/writing',
    color: '#f97316',
    desc: 'Write essays with a time limit — AI gives grammar corrections',
    tip: 'Timed activity with word count target',
  },
];

function ScoreRing({ score, color }) {
  const r = 32, stroke = 5, circ = 2 * Math.PI * r;
  const dash = ((score || 0) / 100) * circ;
  return (
    <svg width={78} height={78}>
      <circle cx={39} cy={39} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={39} cy={39} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 39 39)" style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={39} y={44} textAnchor="middle" fill="white" fontSize={15} fontWeight={700}>{Math.round(score || 0)}</text>
    </svg>
  );
}

export default function LSRWPage() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const [progress, setProgress] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([getLSRWProgress(user.id), getLSRWRecent(user.id)])
      .then(([p, r]) => { setProgress(p.progress || []); setRecent(r.recent || []); })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, [user]);

  const getSkillScore = (key) => {
    const p = progress.find(x => x.skill_type === key);
    return p ? { score: p.average_score || 0, sessions: p.sessions_count || 0 } : { score: 0, sessions: 0 };
  };

  const overall = progress.length
    ? progress.reduce((s, p) => s + (p.average_score || 0), 0) / 4
    : 0;

  return (
    <PageTransition>
      <div style={{ padding: '28px 28px 48px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
              🗣️
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>LSRW Skills</h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Listening · Speaking · Reading · Writing — AI-powered English training
              </p>
            </div>
          </div>
        </motion.div>

        {/* API unavailable banner */}
        {apiError && (
          <div style={{ padding: '12px 18px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 24, fontSize: '0.85rem', color: 'var(--brand-400)' }}>
            ⚠️ LSRW Skills is temporarily unavailable. Please try again in a few minutes.
          </div>
        )}

        {/* Overall score + skills grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, marginBottom: 28 }}>

          {/* Overall score card */}
          <motion.div className="glass-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(168,85,247,0.08))', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overall Score</div>
            <svg width={110} height={110}>
              <circle cx={55} cy={55} r={46} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
              <circle cx={55} cy={55} r={46} fill="none" stroke="url(#lsrwGrad)" strokeWidth={8}
                strokeDasharray={`${(overall / 100) * 2 * Math.PI * 46} ${2 * Math.PI * 46}`}
                strokeLinecap="round" transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray 1s ease' }} />
              <defs>
                <linearGradient id="lsrwGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <text x={55} y={52} textAnchor="middle" fill="white" fontSize={26} fontWeight={800}>{Math.round(overall)}</text>
              <text x={55} y={70} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={11}>/ 100</text>
            </svg>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', marginTop: 16 }}>
              {SKILLS.map(s => {
                const { score } = getSkillScore(s.key);
                return (
                  <div key={s.key} style={{ textAlign: 'center', padding: '6px 4px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.9rem' }}>{s.emoji}</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: s.color }}>{Math.round(score)}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Skill cards 2×2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {SKILLS.map((skill, i) => {
              const Icon = skill.icon;
              const { score, sessions } = getSkillScore(skill.key);
              return (
                <motion.div key={skill.key} className="glass-card"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -3, boxShadow: `0 8px 32px ${skill.color}22` }}
                  onClick={() => navigate(skill.path)}
                  style={{ padding: '20px 20px 16px', cursor: 'pointer', border: `1px solid ${skill.color}22`, position: 'relative', overflow: 'hidden' }}>

                  {/* Glow bg */}
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${skill.color}12`, pointerEvents: 'none' }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: `${skill.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <Icon size={20} style={{ color: skill.color }} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                        {skill.emoji} {skill.label}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
                        {skill.desc}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: skill.color, opacity: 0.7 }}>
                        {skill.tip}
                      </div>
                    </div>
                    <ScoreRing score={score} color={skill.color} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{sessions} session{sessions !== 1 ? 's' : ''}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: skill.color, fontWeight: 600 }}>
                      Practice <HiOutlineArrowRight size={13} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        {recent.length > 0 && (
          <motion.div className="glass-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <HiOutlineClock size={18} style={{ color: 'var(--text-muted)' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Sessions</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {recent.map(ev => {
                const skill = SKILLS.find(s => s.key === ev.skill_type);
                const grade = ev.score >= 85 ? { label: 'Excellent', color: '#10b981' }
                  : ev.score >= 70 ? { label: 'Good', color: '#3b82f6' }
                  : ev.score >= 55 ? { label: 'Average', color: '#f59e0b' }
                  : { label: 'Needs Work', color: '#ef4444' };
                return (
                  <div key={ev.id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: '1.4rem' }}>{skill?.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{skill?.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{new Date(ev.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: grade.color }}>{Math.round(ev.score)}</div>
                      <div style={{ fontSize: '0.68rem', color: grade.color }}>{grade.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
