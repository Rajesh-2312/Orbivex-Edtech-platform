import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import useAuthStore from '../store/authStore';
import OrbitalScene from '../components/landing/OrbitalScene';
import './LandingPage.css';

const fadeUp = { hidden: { opacity: 0, y: 40 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] } }) };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

function CountUp({ to, suffix = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    let frame, start = Date.now();
    (function tick() {
      const p = Math.min((Date.now() - start) / 1600, 1);
      const v = Math.round((1 - Math.pow(1 - p, 3)) * to);
      if (ref.current) ref.current.textContent = v.toLocaleString() + suffix;
      if (p < 1) frame = requestAnimationFrame(tick);
    })();
    return () => cancelAnimationFrame(frame);
  }, [to, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

/* ── Marquee ── */
const marqueeItems = ['AI Course Generation', 'Auto Quiz Creation', 'Smart Grading', 'Plagiarism Detection', 'Personalized Learning Paths', 'Career Job Board', 'Multi-College Management', 'Question Bank & Test Papers'];
function Marquee() {
  return (
    <div className="lp-marquee">
      <div className="lp-marquee-track">
        {[...marqueeItems, ...marqueeItems].map((t, i) => (
          <span key={i} className="lp-marquee-item"><span className="lp-marquee-dot">◆</span>{t}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Bento Feature Card ── */
function BentoCard({ icon, title, desc, span, delay, children }) {
  return (
    <motion.div className={`lp-bc ${span}`} variants={fadeUp} custom={delay} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}>
      <div className={`lp-bc-icon ${icon.bg}`}>{icon.emoji}</div>
      <h3 className="lp-bc-title">{title}</h3>
      <p className="lp-bc-desc">{desc}</p>
      {children}
    </motion.div>
  );
}

/* ── Terminal Mock ── */
function TerminalMock() {
  return (
    <div className="lp-terminal">
      <div className="lp-term-bar"><div className="lp-td r" /><div className="lp-td y" /><div className="lp-td g" /><span className="lp-term-file">orbivex-api • quizAgent.js</span></div>
      <div className="lp-term-body">
        <div><span className="tp">›</span> <span className="tc">POST /api/ai/generate-quiz</span></div>
        <div><span className="tco">// Lesson: React Hooks — useEffect & useState</span></div>
        <div>&nbsp;</div>
        <div><span className="tk">model</span>: <span className="ts">"tinyllama"</span></div>
        <div><span className="tk">count</span>: <span className="tv">5</span></div>
        <div>&nbsp;</div>
        <div><span className="to">✓ Connecting to Ollama</span></div>
        <div><span className="to">✓ Generating 5 MCQs from lesson content...</span></div>
        <div><span className="to">✓ Validating structured JSON output</span></div>
        <div>&nbsp;</div>
        <div><span className="ts">→ 5 questions generated in 3.1s</span></div>
        <div><span className="ts">→ API cost: $0.00</span><span className="lp-tcur" /></div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  useEffect(() => { if (user) navigate('/dashboard', { replace: true }); }, [user]);

  return (
    <div className="lp">
      {/* ── NAV ── */}
      <motion.nav className="lp-nav" initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
        <a className="lp-brand" href="#"><div className="lp-mark">O</div><span className="lp-name">Orbivex</span></a>
        <ul className="lp-links"><li><a href="#features">Features</a></li><li><a href="#ai">AI Engine</a></li><li><a href="#how">Getting started</a></li></ul>
        <div className="lp-actions"><a href="/login" className="lp-btn lp-btn-ghost">Log in</a><a href="/signup" className="lp-btn lp-btn-gold">Get started →</a></div>
      </motion.nav>

      {/* ── HERO ── */}
      <motion.section className="lp-hero" style={{ opacity: heroOpacity, scale: heroScale }}>
        {/* 3D Background */}
        <div className="lp-hero-3d">
          <OrbitalScene />
        </div>

        <div className="lp-hero-content">
          <motion.div className="lp-eyebrow" variants={fadeUp} initial="hidden" animate="visible" custom={0.3}>AI-Powered EdTech Platform</motion.div>
          <motion.h1 className="lp-h1" variants={fadeUp} initial="hidden" animate="visible" custom={0.5}>
            Where <em>intelligence</em><br />meets the<br />classroom
          </motion.h1>
          <motion.p className="lp-sub" variants={fadeUp} initial="hidden" animate="visible" custom={0.7}>
            Orbivex delivers AI-generated courses, instant quizzes, smart grading, plagiarism detection, and a built-in job board.
          </motion.p>
          <motion.div className="lp-hero-acts" variants={fadeUp} initial="hidden" animate="visible" custom={0.9}>
            <a href="/signup" className="lp-btn lp-btn-gold lp-btn-lg">Get started →</a>
            <a href="#features" className="lp-btn lp-btn-outline-lg">Explore features ↓</a>
          </motion.div>
          <motion.div className="lp-trust" variants={fadeUp} initial="hidden" animate="visible" custom={1.1}>
            <div className="lp-trust-item"><span className="lp-trust-num">4,000+</span><span className="lp-trust-lbl">Students</span></div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item"><span className="lp-trust-num">12+</span><span className="lp-trust-lbl">Colleges</span></div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item"><span className="lp-trust-num">8+</span><span className="lp-trust-lbl">AI Features</span></div>
          </motion.div>
        </div>

        {/* Floating glass cards */}
        <motion.div className="lp-float-card lp-fc1" animate={{ y: [0, -14, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="lp-fc-label">Quiz Generated</div>
          <div className="lp-fc-value">18 MCQs</div>
          <div className="lp-fc-sub">↑ Instant AI Generation</div>
        </motion.div>
        <motion.div className="lp-float-card lp-fc2" animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="lp-fc-label">Your Progress</div>
          <div className="lp-fc-value">87%</div>
          <div className="lp-fc-sub">↑ Top of your batch</div>
        </motion.div>
      </motion.section>

      <Marquee />

      {/* ── FEATURES ── */}
      <section className="lp-features" id="features">
        <motion.div className="lp-features-head" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div className="lp-section-tag" variants={fadeUp}>Platform Capabilities</motion.div>
          <motion.h2 className="lp-section-h" variants={fadeUp}>Everything a smart<br />campus <em>actually needs</em></motion.h2>
          <motion.p className="lp-section-p" variants={fadeUp}>From enrollment to graduation — every tool your institution needs, powered by advanced AI.</motion.p>
        </motion.div>

        <div className="lp-bento">
          <BentoCard icon={{ emoji: '🧠', bg: 'ic-g' }} title="AI Quiz Generation" desc="Auto-generate rich MCQ quizzes from any lesson content in seconds." span="lp-bc-1" delay={0}>
            <div className="lp-quiz-mock">
              <div className="lp-quiz-tag">✦ Generated by tinyllama · 3.1s</div>
              <div className="lp-quiz-q">Which React hook handles side effects?</div>
              <div className="lp-quiz-opts">
                <div className="lp-quiz-opt">A.  useState</div>
                <div className="lp-quiz-opt ok">B.  useEffect</div>
                <div className="lp-quiz-opt">C.  useContext</div>
                <div className="lp-quiz-opt">D.  useMemo</div>
              </div>
            </div>
          </BentoCard>
          <BentoCard icon={{ emoji: '📚', bg: 'ic-v' }} title="AI Course Generation" desc="Prompt a subject, get a full course with lessons generated instantly." span="lp-bc-2" delay={1}>
            <div className="lp-course-list">
              {[{ name: 'Introduction to Machine Learning', color: '#c9a84c', badge: 'AI Draft' }, { name: 'Advanced DBMS Concepts', color: '#5a4fe6', badge: 'AI Draft' }, { name: 'Python for Data Science', color: '#22d3ee', badge: 'Published' }].map((c, i) => (
                <div className="lp-course-item" key={i}><div className="lp-course-dot" style={{ background: c.color }} /><span className="lp-course-name">{c.name}</span><span className="lp-course-badge">{c.badge}</span></div>
              ))}
            </div>
          </BentoCard>
          <BentoCard icon={{ emoji: '💼', bg: 'ic-c' }} title="Career Job Board" desc="Students browse and apply for jobs. Track every application from submission to offer." span="lp-bc-3" delay={2} />
          <BentoCard icon={{ emoji: '📊', bg: 'ic-g' }} title="Progress Analytics" desc="Visual dashboards with completion rates and engagement data." span="lp-bc-4" delay={1} />
          <BentoCard icon={{ emoji: '🔍', bg: 'ic-v' }} title="Plagiarism Detection" desc="AI-powered originality checks with instant results." span="lp-bc-5" delay={2} />
          <BentoCard icon={{ emoji: '🏫', bg: 'ic-c' }} title="Multi-Tenant Colleges" desc="Manage colleges, branches, sections with fine-grained access." span="lp-bc-6" delay={3} />
        </div>
      </section>

      {/* ── AI ENGINE ── */}
      <section className="lp-ai-sec" id="ai">
        <div className="lp-ai-inner">
          <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.div className="lp-section-tag" variants={fadeUp}>AI Studio</motion.div>
            <motion.h2 className="lp-section-h" variants={fadeUp}>Advanced<br /><em>AI Capabilities.</em></motion.h2>
            <motion.p className="lp-section-p" variants={fadeUp} style={{ marginTop: '1.1rem' }}>Integrated AI features like course generation, quiz generation, and smart grading right into the learning experience.</motion.p>
            <div className="lp-ai-list">
              {[{ icon: '⚡', title: 'Instant Quiz Generation', desc: 'Lesson content → MCQ quiz in ~3s using tinyllama.' },
                { icon: '🎯', title: 'Personalized Learning Paths', desc: 'AI recommends next lessons based on student progress.' },
                { icon: '📝', title: 'Automated Rubric Grading', desc: 'AI grades assignments with written feedback at scale.' }
              ].map((item, i) => (
                <motion.div className="lp-ai-item" key={i} variants={fadeUp} custom={i + 2}>
                  <div className="lp-ai-icon">{item.icon}</div>
                  <div><h4>{item.title}</h4><p>{item.desc}</p></div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div variants={fadeUp} custom={3} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <TerminalMock />
          </motion.div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="lp-stats-sec">
        <motion.div className="lp-stats-grid" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
          {[{ n: 4000, sfxAfter: '+', label: 'Active Students', sub: 'Across multiple colleges' },
            { n: 8, label: 'Core Capabilities', sub: 'Courses, Jobs, Tests & more' },
            { n: 6, label: 'AI Agents Built-in', sub: 'Quiz · Grade · Plagiarism · More' },
            { n: 100, sfxAfter: '%', label: 'AI-Powered', sub: 'Integrated smart learning' }
          ].map((s, i) => (
            <motion.div className="lp-stat" key={i} variants={fadeUp} custom={i}>
              <div className="lp-stat-bar" />
              <div className="lp-stat-n">{s.sfxBefore && <span className="lp-stat-sfx">{s.sfxBefore}</span>}<CountUp to={s.n} />{s.sfxAfter && <span className="lp-stat-sfx">{s.sfxAfter}</span>}</div>
              <div className="lp-stat-lbl">{s.label}</div>
              <div className="lp-stat-sub">{s.sub}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-how-sec" id="how">
        <div className="lp-how-inner">
          <motion.div className="lp-how-head" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.div className="lp-section-tag" variants={fadeUp} style={{ justifyContent: 'center' }}>Getting Started</motion.div>
            <motion.h2 className="lp-section-h" variants={fadeUp}>Up and running in<br /><em>minutes, not months</em></motion.h2>
            <motion.p className="lp-section-p" variants={fadeUp}>Experience intelligent learning pathways instantly.</motion.p>
          </motion.div>
          <div className="lp-steps">
            {[{ n: '01', title: 'Create an Account', desc: 'Sign up to explore personalized learning experiences.', tag: '👤 Quick Onboarding' },
              { n: '02', title: 'Enroll in Courses', desc: 'Browse and join courses generated with advanced AI.', tag: '📚 Learning Paths' },
              { n: '03', title: 'Take AI Quizzes', desc: 'Test your knowledge with auto-generated assessments.', tag: '📝 Smart Testing' },
              { n: '04', title: 'Apply for Jobs', desc: 'Discover career opportunities directly on the platform.', tag: '💼 Career Board' }
            ].map((step, i) => (
              <motion.div className="lp-step" key={i} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <div className="lp-step-n">{step.n}</div>
                <div><h3 className="lp-step-title">{step.title}</h3><p className="lp-step-desc">{step.desc}</p><span className="lp-step-tag">{step.tag}</span></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta-sec">
        <div className="lp-cta-glow" />
        <motion.div className="lp-cta-inner" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div className="lp-section-tag" variants={fadeUp} style={{ justifyContent: 'center' }}>Start today</motion.div>
          <motion.h2 className="lp-section-h lp-cta-h" variants={fadeUp}>Your campus deserves<br /><em>intelligent learning</em></motion.h2>
          <motion.p className="lp-section-p" variants={fadeUp}>Experience Orbivex. Built for modern education.</motion.p>
          <motion.div className="lp-cta-acts" variants={fadeUp}>
            <a href="/signup" className="lp-btn lp-btn-gold lp-btn-lg">Get started →</a>
          </motion.div>
          <motion.p className="lp-cta-note" variants={fadeUp}>Intelligent learning platform · AI-powered</motion.p>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-foot-brand"><div className="lp-mark">O</div><span className="lp-foot-copy">© 2026 Orbivex. Built for education.</span></div>
        <div className="lp-foot-links"><a href="#features">Features</a><a href="#ai">AI Engine</a><a href="#">Documentation</a><a href="/admin">Admin</a></div>
      </footer>
    </div>
  );
}
