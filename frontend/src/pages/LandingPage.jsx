import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  HiOutlineSparkles, HiOutlineBookOpen, HiOutlineTrophy, HiOutlineChartBar,
  HiOutlineMagnifyingGlass, HiOutlineBuildingOffice2,
  HiOutlineXMark,
} from 'react-icons/hi2';
import useAuthStore from '../store/authStore';
import OrbitalScene from '../components/landing/OrbitalScene';
import './LandingPage.css';

const fadeUp = { hidden: { opacity: 0, y: 40 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] } }) };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

function CountUp({ to, suffix = '', prefix = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    let frame; let start = Date.now();
    (function tick() {
      const p = Math.min((Date.now() - start) / 1600, 1);
      const v = Math.round((1 - Math.pow(1 - p, 3)) * to);
      if (ref.current) ref.current.textContent = prefix + v.toLocaleString('en-IN') + suffix;
      if (p < 1) frame = requestAnimationFrame(tick);
    })();
    return () => cancelAnimationFrame(frame);
  }, [to, suffix, prefix]);
  return <span ref={ref}>{prefix}0{suffix}</span>;
}

const marqueeItems = [
  'AI Quiz Generation', 'Auto Course Builder', 'Smart Grading', 'Plagiarism Detection',
  'Personalized Learning', 'Job Board & Placement', 'Multi-College Management',
  'Question Bank & Test Papers', 'Company Prep Portal', 'LSRW Skills Assessment',
  'AI Tutor Chatbot', 'Placement Analytics'
];
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

function BentoCard({ icon, title, desc, span, delay, children }) {
  const Cmp = icon.Cmp;
  return (
    <motion.div className={`lp-bc ${span}`} variants={fadeUp} custom={delay} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}>
      <div className={`lp-bc-icon ${icon.bg}`}><Cmp size={24} style={{ color: icon.color }} aria-hidden="true" /></div>
      <h3 className="lp-bc-title">{title}</h3>
      <p className="lp-bc-desc">{desc}</p>
      {children}
    </motion.div>
  );
}

/* ── Demo Request Modal ── */
function DemoModal({ onClose }) {
  const [form, setForm] = useState({ name: '', college: '', phone: '', email: '', students: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: wire up to a backend endpoint for demo requests
    setSubmitted(true);
  };

  return (
    <motion.div className="lp-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="lp-modal-box" role="dialog" aria-modal="true" aria-label="Request a free demo" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        {!submitted ? (
          <>
            <div className="lp-modal-head">
              <h3>Request a Free Demo</h3>
              <p>We'll call you within 24 hours and set up a live walkthrough for your college.</p>
              <button className="lp-modal-close" onClick={onClose} aria-label="Close demo request dialog"><HiOutlineXMark size={18} /></button>
            </div>
            <form className="lp-demo-form" onSubmit={handleSubmit}>
              <input required placeholder="Your Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input required placeholder="College Name" value={form.college} onChange={e => setForm({ ...form, college: e.target.value })} />
              <input required type="tel" placeholder="Phone Number" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input required type="email" placeholder="Official Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <select value={form.students} onChange={e => setForm({ ...form, students: e.target.value })} required>
                <option value="">Number of Students</option>
                <option value="<500">Less than 500</option>
                <option value="500-2000">500 – 2,000</option>
                <option value="2000+">2,000+</option>
              </select>
              <button type="submit" className="lp-btn lp-btn-gold" style={{ width: '100%' }}>Request Demo →</button>
            </form>
          </>
        ) : (
          <div className="lp-demo-success">
            <div className="lp-demo-success-icon">🎉</div>
            <h3>Demo Requested!</h3>
            <p>We'll call you within 24 hours.<br />WhatsApp us at <strong>+91 90000 00000</strong> for faster response.</p>
            <button className="lp-btn lp-btn-gold" onClick={onClose} style={{ marginTop: '1rem' }}>Close</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── Comparison Table ── */
function ComparisonSection() {
  const rows = [
    { feature: 'AI Quiz Generation', orbivex: true, lms: false, manual: false },
    { feature: 'AI Course Builder', orbivex: true, lms: false, manual: false },
    { feature: 'Company Prep Portal', orbivex: true, lms: false, manual: false },
    { feature: 'Placement Analytics', orbivex: true, lms: '⚠️ Limited', manual: false },
    { feature: 'Multi-college Management', orbivex: true, lms: '⚠️ Extra', manual: false },
    { feature: 'LSRW Skills Assessment', orbivex: true, lms: false, manual: false },
    { feature: 'Indian curriculum focus', orbivex: true, lms: false, manual: false },
    { feature: 'Dedicated support (India TZ)', orbivex: true, lms: false, manual: 'N/A' },
  ];
  return (
    <section className="lp-compare-sec">
      <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        <motion.div className="lp-section-tag" variants={fadeUp} style={{ justifyContent: 'center' }}>Why Orbivex</motion.div>
        <motion.h2 className="lp-section-h" variants={fadeUp} style={{ textAlign: 'center' }}>Built for <em>Indian colleges</em>, unlike the rest</motion.h2>
      </motion.div>
      <div className="lp-compare-wrap">
        <table className="lp-compare-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th className="lp-compare-orbivex">Orbivex</th>
              <th>Generic LMS</th>
              <th>Manual Process</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{row.feature}</td>
                <td className="lp-compare-orbivex">
                  {row.orbivex === true ? <span className="lp-yes">✓</span> : row.orbivex}
                </td>
                <td>{row.lms === true ? <span className="lp-yes">✓</span> : row.lms === false ? <span className="lp-no">✗</span> : row.lms}</td>
                <td>{row.manual === true ? <span className="lp-yes">✓</span> : row.manual === false ? <span className="lp-no">✗</span> : row.manual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => { if (user) navigate('/dashboard', { replace: true }); }, [user]);

  return (
    <div className="lp">
      {/* ── NAV ── */}
      <motion.nav className="lp-nav" initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
        <a className="lp-brand" href="#"><div className="lp-mark">O</div><span className="lp-name">Orbivex</span></a>
        <ul className="lp-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how">How it Works</a></li>
        </ul>
        <div className="lp-actions">
          <button className="lp-btn lp-btn-demo" onClick={() => setDemoOpen(true)}>Schedule Demo</button>
          <a href="/login" className="lp-btn lp-btn-ghost">Log in</a>
          <a href="/onboarding" className="lp-btn lp-btn-gold">Get Started →</a>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <motion.section className="lp-hero" style={{ opacity: heroOpacity, scale: heroScale }}>
        <div className="lp-hero-3d"><OrbitalScene /></div>
        <div className="lp-hero-content">
          <motion.div className="lp-eyebrow" variants={fadeUp} initial="hidden" animate="visible" custom={0.2}>
            🇮🇳 Built for Indian Engineering Colleges
          </motion.div>
          <motion.h1 className="lp-h1" variants={fadeUp} initial="hidden" animate="visible" custom={0.4}>
            The AI-Powered LMS<br /><em>Indian colleges</em><br />actually need
          </motion.h1>
          <motion.p className="lp-sub" variants={fadeUp} initial="hidden" animate="visible" custom={0.6}>
            Orbivex delivers AI course generation, instant quiz creation, smart grading, placement analytics, and a career board — built for 4,000+ students across AP & Telangana.
          </motion.p>
          <motion.div className="lp-hero-acts" variants={fadeUp} initial="hidden" animate="visible" custom={0.8}>
            <a href="/onboarding" className="lp-btn lp-btn-gold lp-btn-lg">Get Started →</a>
            <button onClick={() => setDemoOpen(true)} className="lp-btn lp-btn-outline-lg">Schedule a Demo ↓</button>
          </motion.div>
          <motion.div className="lp-hero-note" variants={fadeUp} initial="hidden" animate="visible" custom={0.9}>
            ✓ Setup in 24 hours &nbsp;·&nbsp; ✓ Dedicated onboarding &nbsp;·&nbsp; ✓ Indian support team
          </motion.div>
          <motion.div className="lp-trust" variants={fadeUp} initial="hidden" animate="visible" custom={1.0}>
            <div className="lp-trust-item"><span className="lp-trust-num"><CountUp to={4000} suffix="+" /></span><span className="lp-trust-lbl">Students</span></div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item"><span className="lp-trust-num"><CountUp to={40} suffix="h" /></span><span className="lp-trust-lbl">Hours Saved/mo</span></div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item"><span className="lp-trust-num"><CountUp to={8} suffix="+" /></span><span className="lp-trust-lbl">AI Features</span></div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item"><span className="lp-trust-num"><CountUp to={84} suffix="%" /></span><span className="lp-trust-lbl">Placement Rate</span></div>
          </motion.div>
        </div>

        <motion.div className="lp-float-card lp-fc1" animate={{ y: [0, -14, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="lp-fc-label">Quiz Generated</div>
          <div className="lp-fc-value">18 MCQs</div>
          <div className="lp-fc-sub">↑ Generated in 2.8s</div>
        </motion.div>
        <motion.div className="lp-float-card lp-fc2" animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="lp-fc-label">Placement Rate</div>
          <div className="lp-fc-value">84%</div>
          <div className="lp-fc-sub">↑ 17pts after Orbivex</div>
        </motion.div>
      </motion.section>

      <Marquee />

      {/* ── FEATURES ── */}
      <section className="lp-features" id="features">
        <motion.div className="lp-features-head" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div className="lp-section-tag" variants={fadeUp}>Platform Capabilities</motion.div>
          <motion.h2 className="lp-section-h" variants={fadeUp}>Everything a smart<br />campus <em>actually needs</em></motion.h2>
          <motion.p className="lp-section-p" variants={fadeUp}>From enrollment to placement — every tool your institution needs, powered by AI that scales to thousands of students.</motion.p>
        </motion.div>
        <div className="lp-bento">
          <BentoCard icon={{ Cmp: HiOutlineSparkles, bg: 'ic-g', color: '#f5d77a' }} title="AI Quiz Generation" desc="Auto-generate rich MCQ quizzes from any lesson content in seconds." span="lp-bc-1" delay={0}>
            <div className="lp-quiz-mock">
              <div className="lp-quiz-tag">✦ Generated in 2.8s</div>
              <div className="lp-quiz-q">Which hook handles side effects in React?</div>
              <div className="lp-quiz-opts">
                <div className="lp-quiz-opt">A. useState</div>
                <div className="lp-quiz-opt ok">B. useEffect ✓</div>
                <div className="lp-quiz-opt">C. useContext</div>
                <div className="lp-quiz-opt">D. useMemo</div>
              </div>
            </div>
          </BentoCard>
          <BentoCard icon={{ Cmp: HiOutlineBookOpen, bg: 'ic-v', color: '#a78bfa' }} title="AI Course Generation" desc="Prompt a subject, get a full course with lessons, descriptions and content — generated in under 60 seconds." span="lp-bc-2" delay={1}>
            <div className="lp-course-list">
              {[{ name: 'Data Structures & Algorithms', color: '#c9a84c', badge: 'AI Draft' }, { name: 'Advanced DBMS Concepts', color: '#5a4fe6', badge: 'AI Draft' }, { name: 'Python for Data Science', color: '#22d3ee', badge: 'Published' }].map((c, i) => (
                <div className="lp-course-item" key={i}><div className="lp-course-dot" style={{ background: c.color }} /><span className="lp-course-name">{c.name}</span><span className="lp-course-badge">{c.badge}</span></div>
              ))}
            </div>
          </BentoCard>
          <BentoCard icon={{ Cmp: HiOutlineTrophy, bg: 'ic-c', color: '#22d3ee' }} title="Company Prep Portal" desc="TCS, Infosys, Wipro, Capgemini roadmaps. Timed practice, AI-generated study notes, real placement success." span="lp-bc-3" delay={2} />
          <BentoCard icon={{ Cmp: HiOutlineChartBar, bg: 'ic-g', color: '#f5d77a' }} title="Placement Analytics" desc="Track drive attendance, shortlisting ratios, offer trends. TPO dashboard with real-time data." span="lp-bc-4" delay={1} />
          <BentoCard icon={{ Cmp: HiOutlineMagnifyingGlass, bg: 'ic-v', color: '#a78bfa' }} title="Plagiarism Detection" desc="AI-powered originality checks on student assignments. Instant reports with similarity scores." span="lp-bc-5" delay={2} />
          <BentoCard icon={{ Cmp: HiOutlineBuildingOffice2, bg: 'ic-c', color: '#22d3ee' }} title="Multi-College Management" desc="Manage colleges, branches, sections. Course access gating by section. Bulk CSV student import." span="lp-bc-6" delay={3} />
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="lp-stats-sec">
        <motion.div className="lp-stats-grid" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
          {[{ n: 4000, sfxAfter: '+', label: 'Active Students', sub: 'Across multiple colleges' },
            { n: 40, sfxAfter: 'h', label: 'Teacher Hours Saved', sub: 'Per month per college' },
            { n: 84, sfxAfter: '%', label: 'Avg Placement Rate', sub: 'At Orbivex-powered colleges' },
            { n: 8, sfxAfter: '+', label: 'AI Features', sub: 'Quizzes, grading, prep & more' }
          ].map((s, i) => (
            <motion.div className="lp-stat" key={i} variants={fadeUp} custom={i}>
              <div className="lp-stat-bar" />
              <div className="lp-stat-n">
                {s.prefix && <span className="lp-stat-sfx">{s.prefix}</span>}
                <CountUp to={s.n} />
                {s.sfxAfter && <span className="lp-stat-sfx">{s.sfxAfter}</span>}
              </div>
              <div className="lp-stat-lbl">{s.label}</div>
              <div className="lp-stat-sub">{s.sub}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── COMPARISON ── */}
      <ComparisonSection />

      {/* ── HOW IT WORKS ── */}
      <section className="lp-how-sec" id="how">
        <div className="lp-how-inner">
          <motion.div className="lp-how-head" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.div className="lp-section-tag" variants={fadeUp} style={{ justifyContent: 'center' }}>Onboarding Process</motion.div>
            <motion.h2 className="lp-section-h" variants={fadeUp} style={{ textAlign: 'center' }}>Live in <em>24 hours,</em> not months</motion.h2>
            <motion.p className="lp-section-p" variants={fadeUp} style={{ textAlign: 'center' }}>Our team handles the entire setup. You just log in and start using it.</motion.p>
          </motion.div>
          <div className="lp-steps">
            {[{ n: '01', title: 'Sign Up & Get Access', desc: 'Create your account and tell us about your college. No card required to begin.', tag: '⏱ 5 minutes' },
              { n: '02', title: 'We Import Your Data', desc: 'Send us your student list (CSV). We set up branches, sections, and user accounts.', tag: '⏱ Within 24 hours' },
              { n: '03', title: 'Add Your Courses', desc: 'Upload existing content or let AI generate courses from your syllabus topics.', tag: '⏱ 1 day' },
              { n: '04', title: 'Go Live', desc: 'Students log in, faculty starts teaching. Our team is on call for 30 days post-launch.', tag: '🚀 Day 2 onwards' }
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
          <motion.div className="lp-section-tag" variants={fadeUp} style={{ justifyContent: 'center' }}>Ready to get started?</motion.div>
          <motion.h2 className="lp-section-h lp-cta-h" variants={fadeUp}>Your college deserves<br /><em>intelligent education</em></motion.h2>
          <motion.p className="lp-section-p" variants={fadeUp}>
            Join colleges across India already using Orbivex. Get your campus up and running today.
          </motion.p>
          <motion.div className="lp-cta-acts" variants={fadeUp}>
            <a href="/onboarding" className="lp-btn lp-btn-gold lp-btn-lg">Get Started →</a>
            <button onClick={() => setDemoOpen(true)} className="lp-btn lp-btn-outline-lg">Schedule a Demo</button>
          </motion.div>
          <motion.p className="lp-cta-note" variants={fadeUp}>
            ✓ Setup in 24 hours &nbsp;·&nbsp; ✓ Dedicated onboarding &nbsp;·&nbsp; ✓ Indian support team
          </motion.p>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-foot-top">
          <div className="lp-foot-brand-col">
            <a className="lp-brand" href="#"><div className="lp-mark">O</div><span className="lp-name">Orbivex</span></a>
            <p>AI-powered LMS built for Indian engineering colleges.</p>
            <div className="lp-foot-contact">
              <span>📧 sales@orbivex.com</span>
              <span>📱 +91 90000 00000</span>
            </div>
          </div>
          <div className="lp-foot-links-col">
            <div className="lp-foot-col">
              <h5>Product</h5>
              <a href="#features">Features</a>
              <a href="#how">How it Works</a>
              <a href="/onboarding">Get Started</a>
            </div>
            <div className="lp-foot-col">
              <h5>Company</h5>
              <a href="#how">Onboarding</a>
              <a href="mailto:sales@orbivex.com">Contact Sales</a>
              <a href="/login">Login</a>
            </div>
            <div className="lp-foot-col">
              <h5>Legal</h5>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Refund Policy</a>
              <a href="#">GST: 37XXXXX</a>
            </div>
          </div>
        </div>
        <div className="lp-foot-bottom">
          <span>© 2026 Orbivex Technologies Pvt. Ltd. · Made in India 🇮🇳</span>
          <span>Servers hosted in India · SOC2 in progress</span>
        </div>
      </footer>

      {/* ── DEMO MODAL ── */}
      <AnimatePresence>
        {demoOpen && <DemoModal onClose={() => setDemoOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
