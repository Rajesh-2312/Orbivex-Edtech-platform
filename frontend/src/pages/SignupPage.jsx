import { motion } from 'framer-motion';
import SignupForm from '../components/auth/SignupForm';

const STATS = [
  { value: '4,000+', label: 'Active students' },
  { value: '200+',   label: 'AI-generated courses' },
  { value: '98%',    label: 'Placement rate' },
];

export default function SignupPage() {
  return (
    <div className="auth-page">
      {/* ── Left panel ── */}
      <motion.div
        className="auth-panel-left"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Orbital planet */}
        <div className="auth-planet-wrap">
          <div className="auth-planet-core" />
          <div className="auth-orbit-ring auth-orbit-ring-1" />
          <div className="auth-orbit-ring auth-orbit-ring-2" />
        </div>

        {/* Brand */}
        <div className="auth-left-brand">
          <div className="auth-left-logo">
            <span className="orbi">ORBI</span>
            <span className="vex">VEX</span>
          </div>
          <p className="auth-left-tagline">Your World. Our Orbit.</p>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 8 }}>
            {STATS.map((s) => (
              <div key={s.label} style={{
                textAlign: 'center',
                padding: '14px 8px',
                background: 'rgba(249,115,22,0.07)',
                border: '1px solid rgba(249,115,22,0.12)',
                borderRadius: 12,
              }}>
                <div style={{ font: '800 1.4rem/1 var(--font-display)', color: 'var(--brand-400)', marginBottom: 4 }}>{s.value}</div>
                <div style={{ font: '400 0.72rem/1.3 var(--font-body)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 24, font: '400 0.88rem/1.6 var(--font-body)', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360 }}>
            Join thousands of students leveling up their careers with AI-powered education.
          </p>
        </div>
      </motion.div>

      {/* ── Right panel ── */}
      <motion.div
        className="auth-panel-right"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      >
        <div className="auth-card">
          <h2 className="auth-card-title">Create account</h2>
          <p className="auth-card-sub">
            Start your journey with <span>Orbivex</span> — it's free
          </p>
          <SignupForm />
        </div>
      </motion.div>
    </div>
  );
}
