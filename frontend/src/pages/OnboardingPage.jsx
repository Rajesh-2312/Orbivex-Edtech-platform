/**
 * Orbivex College Onboarding Wizard
 * Self-service: College details → Plan → Payment → Admin setup → Go live
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

const PLANS = [
  { id: 'starter',    name: 'Starter',    price: 8000,  students: 500,  color: '#6366f1', popular: false },
  { id: 'growth',     name: 'Growth',     price: 15000, students: 2000, color: '#f97316', popular: true  },
  { id: 'enterprise', name: 'Enterprise', price: 25000, students: null, color: '#22d3ee', popular: false },
];

const STEPS = [
  { id: 'college',  label: 'College Details', icon: '🏫' },
  { id: 'plan',     label: 'Choose Plan',     icon: '📋' },
  { id: 'admin',    label: 'Admin Account',   icon: '👤' },
  { id: 'payment',  label: 'Start Trial',     icon: '🚀' },
];

export default function OnboardingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [college, setCollege] = useState({
    name: '', code: '', type: 'Engineering', address: '',
    city: '', state: 'Andhra Pradesh', phone: '', principal_email: '',
    student_count: '', established_year: '',
  });
  const [selectedPlan, setSelectedPlan] = useState(searchParams.get('plan') || 'growth');
  const [admin, setAdmin] = useState({ display_name: '', email: '', password: '', confirm_password: '' });
  const [submitted, setSubmitted] = useState(false);

  const plan = PLANS.find(p => p.id === selectedPlan);

  const validateStep = () => {
    if (step === 0) {
      if (!college.name || !college.city || !college.state || !college.principal_email) {
        setError('Please fill in all required fields.'); return false;
      }
    }
    if (step === 2) {
      if (!admin.display_name || !admin.email || !admin.password) {
        setError('Please fill in all required fields.'); return false;
      }
      if (admin.password !== admin.confirm_password) {
        setError('Passwords do not match.'); return false;
      }
      if (admin.password.length < 8) {
        setError('Password must be at least 8 characters.'); return false;
      }
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Create college + admin account via API
      const res = await api.post('/auth/onboard-college', {
        college,
        plan_id: selectedPlan,
        admin_name: admin.display_name,
        admin_email: admin.email,
        admin_password: admin.password,
      });

      if (res.data.success) {
        setSubmitted(true);
      } else {
        setError(res.data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  if (submitted) {
    return (
      <div className="ob-success">
        <motion.div className="ob-success-card" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="ob-success-icon">🎉</div>
          <h1>You're all set!</h1>
          <p>
            Your 14-day free trial for <strong>{college.name}</strong> has started on the <strong>{plan?.name}</strong> plan.
            We'll set up your platform and send login details to <strong>{admin.email}</strong> within 2 hours.
          </p>
          <div className="ob-success-next">
            <div className="ob-next-item">✓ Admin account created</div>
            <div className="ob-next-item">✓ Trial activated (14 days)</div>
            <div className="ob-next-item">⏳ Login credentials via email</div>
            <div className="ob-next-item">⏳ Our team sets up your college data</div>
          </div>
          <div className="ob-success-actions">
            <a href="/login" className="ob-btn ob-btn-gold">Go to Login →</a>
            <a href="/" className="ob-btn ob-btn-ghost">Back to Home</a>
          </div>
          <div className="ob-success-contact">
            Need help? WhatsApp us: <strong>+91 90000 00000</strong>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="ob">
      {/* Header */}
      <div className="ob-header">
        <a href="/" className="ob-brand">
          <div className="ob-mark">O</div>
          <span>Orbivex</span>
        </a>
        <div className="ob-header-right">
          Already have an account? <a href="/login">Log in</a>
        </div>
      </div>

      <div className="ob-body">
        {/* Sidebar steps */}
        <div className="ob-sidebar">
          <div className="ob-sidebar-title">Get Started</div>
          <div className="ob-sidebar-sub">14-day free trial · No credit card</div>
          <div className="ob-steps-list">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`ob-step-item ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                <div className="ob-step-dot">{i < step ? '✓' : i + 1}</div>
                <div>
                  <div className="ob-step-label">{s.label}</div>
                  <div className="ob-step-icon">{s.icon}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="ob-sidebar-plan">
            <div className="ob-plan-chip">Selected Plan</div>
            <div className="ob-plan-name">{plan?.name}</div>
            <div className="ob-plan-price">₹{plan?.price?.toLocaleString('en-IN')}/mo</div>
          </div>
        </div>

        {/* Main form */}
        <div className="ob-main">
          <div className="ob-progress-bar">
            <div className="ob-progress-fill" style={{ width: `${((step) / (STEPS.length - 1)) * 100}%` }} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="ob-form-wrap"
            >
              {/* Step 0: College Details */}
              {step === 0 && (
                <div className="ob-form">
                  <h2>Tell us about your college</h2>
                  <p>We'll set up your platform based on this information.</p>
                  <div className="ob-form-grid">
                    <div className="ob-field ob-field-full">
                      <label>College Name *</label>
                      <input placeholder="e.g. Sai Engineering College" value={college.name} onChange={e => setCollege({ ...college, name: e.target.value })} />
                    </div>
                    <div className="ob-field">
                      <label>College Code</label>
                      <input placeholder="e.g. SEC001" value={college.code} onChange={e => setCollege({ ...college, code: e.target.value })} />
                    </div>
                    <div className="ob-field">
                      <label>Type</label>
                      <select value={college.type} onChange={e => setCollege({ ...college, type: e.target.value })}>
                        <option>Engineering</option>
                        <option>Polytechnic</option>
                        <option>Arts & Science</option>
                        <option>Medical</option>
                        <option>Management</option>
                        <option>Autonomous</option>
                      </select>
                    </div>
                    <div className="ob-field">
                      <label>City *</label>
                      <input placeholder="Visakhapatnam" value={college.city} onChange={e => setCollege({ ...college, city: e.target.value })} />
                    </div>
                    <div className="ob-field">
                      <label>State *</label>
                      <select value={college.state} onChange={e => setCollege({ ...college, state: e.target.value })}>
                        {['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Kerala', 'Rajasthan', 'Gujarat', 'Uttar Pradesh', 'Other'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="ob-field">
                      <label>Principal Email *</label>
                      <input type="email" placeholder="principal@college.edu.in" value={college.principal_email} onChange={e => setCollege({ ...college, principal_email: e.target.value })} />
                    </div>
                    <div className="ob-field">
                      <label>Phone Number</label>
                      <input placeholder="+91 98765 43210" value={college.phone} onChange={e => setCollege({ ...college, phone: e.target.value })} />
                    </div>
                    <div className="ob-field">
                      <label>Approx. Students</label>
                      <select value={college.student_count} onChange={e => setCollege({ ...college, student_count: e.target.value })}>
                        <option value="">Select</option>
                        <option>Less than 500</option>
                        <option>500 – 1,000</option>
                        <option>1,000 – 2,000</option>
                        <option>2,000 – 5,000</option>
                        <option>5,000+</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Plan Selection */}
              {step === 1 && (
                <div className="ob-form">
                  <h2>Choose your plan</h2>
                  <p>All plans include a 14-day free trial. No credit card required.</p>
                  <div className="ob-plans">
                    {PLANS.map(p => (
                      <div
                        key={p.id}
                        className={`ob-plan-card ${selectedPlan === p.id ? 'selected' : ''} ${p.popular ? 'popular' : ''}`}
                        onClick={() => setSelectedPlan(p.id)}
                        style={{ '--c': p.color }}
                      >
                        {p.popular && <div className="ob-popular-badge">Most Popular</div>}
                        <div className="ob-pc-name">{p.name}</div>
                        <div className="ob-pc-price">
                          <span>₹</span>{p.price.toLocaleString('en-IN')}<span>/mo</span>
                        </div>
                        <div className="ob-pc-limit">{p.students ? `Up to ${p.students.toLocaleString('en-IN')} students` : 'Unlimited students'}</div>
                        <div className={`ob-pc-check ${selectedPlan === p.id ? 'visible' : ''}`}>✓ Selected</div>
                      </div>
                    ))}
                  </div>
                  <div className="ob-plan-note">
                    💡 Not sure? Start with <strong>Growth</strong> — most Indian colleges pick it. You can upgrade anytime.
                  </div>
                </div>
              )}

              {/* Step 2: Admin Account */}
              {step === 2 && (
                <div className="ob-form">
                  <h2>Create your admin account</h2>
                  <p>This will be the master admin for <strong>{college.name}</strong>.</p>
                  <div className="ob-form-grid">
                    <div className="ob-field ob-field-full">
                      <label>Full Name *</label>
                      <input placeholder="Dr. Ramesh Naidu" value={admin.display_name} onChange={e => setAdmin({ ...admin, display_name: e.target.value })} />
                    </div>
                    <div className="ob-field ob-field-full">
                      <label>Email Address *</label>
                      <input type="email" placeholder="admin@yourcollege.edu.in" value={admin.email} onChange={e => setAdmin({ ...admin, email: e.target.value })} />
                    </div>
                    <div className="ob-field">
                      <label>Password *</label>
                      <input type="password" placeholder="Minimum 8 characters" value={admin.password} onChange={e => setAdmin({ ...admin, password: e.target.value })} />
                    </div>
                    <div className="ob-field">
                      <label>Confirm Password *</label>
                      <input type="password" placeholder="Repeat password" value={admin.confirm_password} onChange={e => setAdmin({ ...admin, confirm_password: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Launch */}
              {step === 3 && (
                <div className="ob-form">
                  <h2>Review & Start Trial</h2>
                  <p>Confirm your details and start your 14-day free trial.</p>
                  <div className="ob-review-card">
                    <div className="ob-review-section">
                      <div className="ob-review-label">College</div>
                      <div className="ob-review-value">{college.name}</div>
                      <div className="ob-review-sub">{college.city}, {college.state}</div>
                    </div>
                    <div className="ob-review-divider" />
                    <div className="ob-review-section">
                      <div className="ob-review-label">Plan</div>
                      <div className="ob-review-value">{plan?.name} — ₹{plan?.price?.toLocaleString('en-IN')}/month</div>
                      <div className="ob-review-sub">14 days free, then billed monthly</div>
                    </div>
                    <div className="ob-review-divider" />
                    <div className="ob-review-section">
                      <div className="ob-review-label">Admin Account</div>
                      <div className="ob-review-value">{admin.display_name}</div>
                      <div className="ob-review-sub">{admin.email}</div>
                    </div>
                  </div>
                  <div className="ob-trial-benefits">
                    <div className="ob-trial-item">✓ 14-day free trial — no card needed</div>
                    <div className="ob-trial-item">✓ Our team sets up your data within 24 hours</div>
                    <div className="ob-trial-item">✓ Cancel anytime during trial</div>
                    <div className="ob-trial-item">✓ GST invoice provided monthly</div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && <div className="ob-error">{error}</div>}

          <div className="ob-form-footer">
            {step > 0 && (
              <button className="ob-btn ob-btn-ghost" onClick={() => { setError(''); setStep(s => s - 1); }}>
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="ob-btn ob-btn-gold" onClick={handleNext}>
                Continue →
              </button>
            ) : (
              <button className="ob-btn ob-btn-gold" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating account...' : '🚀 Start Free Trial'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .ob { min-height: 100vh; background: #020209; color: #eae8f6; font-family: 'Outfit', system-ui, sans-serif; }
        .ob-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 2.5rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .ob-brand { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: inherit; font-weight: 700; font-size: 1.1rem; }
        .ob-mark { width: 32px; height: 32px; background: linear-gradient(135deg, #f97316, #6366f1); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 1rem; }
        .ob-header-right { font-size: 0.88rem; color: #7a7a9a; }
        .ob-header-right a { color: #f97316; text-decoration: none; font-weight: 600; margin-left: 0.4rem; }
        .ob-body { display: flex; min-height: calc(100vh - 65px); }
        .ob-sidebar { width: 280px; flex-shrink: 0; background: #07070f; border-right: 1px solid rgba(255,255,255,0.06); padding: 2.5rem 2rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .ob-sidebar-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.2rem; }
        .ob-sidebar-sub { font-size: 0.8rem; color: #7a7a9a; margin-bottom: 2rem; }
        .ob-steps-list { display: flex; flex-direction: column; gap: 0.75rem; flex: 1; }
        .ob-step-item { display: flex; align-items: center; gap: 0.85rem; padding: 0.75rem; border-radius: 10px; transition: background 0.2s; }
        .ob-step-item.active { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); }
        .ob-step-item.done .ob-step-dot { background: #4ade80; color: #000; }
        .ob-step-dot { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 700; flex-shrink: 0; }
        .ob-step-item.active .ob-step-dot { background: #f97316; color: #000; }
        .ob-step-label { font-size: 0.85rem; font-weight: 600; }
        .ob-step-icon { font-size: 0.75rem; color: #7a7a9a; }
        .ob-sidebar-plan { margin-top: 2rem; padding: 1rem; background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.2); border-radius: 12px; }
        .ob-plan-chip { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #7a7a9a; margin-bottom: 0.25rem; }
        .ob-plan-name { font-weight: 700; font-size: 1rem; color: #f97316; }
        .ob-plan-price { font-size: 0.82rem; color: #7a7a9a; }
        .ob-main { flex: 1; padding: 3rem 4rem; max-width: 800px; }
        .ob-progress-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; margin-bottom: 3rem; overflow: hidden; }
        .ob-progress-fill { height: 100%; background: linear-gradient(90deg, #f97316, #6366f1); border-radius: 2px; transition: width 0.4s ease; }
        .ob-form-wrap {}
        .ob-form h2 { font-size: 1.8rem; font-weight: 800; margin-bottom: 0.4rem; }
        .ob-form > p { color: #7a7a9a; margin-bottom: 2rem; font-size: 0.95rem; }
        .ob-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .ob-field { display: flex; flex-direction: column; gap: 0.4rem; }
        .ob-field-full { grid-column: span 2; }
        .ob-field label { font-size: 0.82rem; font-weight: 600; color: #7a7a9a; }
        .ob-field input, .ob-field select { background: #0d0d1f; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.75rem 1rem; color: #eae8f6; font-size: 0.9rem; font-family: inherit; outline: none; transition: border-color 0.2s; }
        .ob-field input:focus, .ob-field select:focus { border-color: #f97316; }
        .ob-field select option { background: #0d0d1f; }
        .ob-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        .ob-plan-card { background: #0d0d1f; border: 2px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.5rem; cursor: pointer; transition: all 0.2s; position: relative; text-align: center; }
        .ob-plan-card.selected { border-color: var(--c); background: color-mix(in srgb, var(--c) 8%, #0d0d1f); }
        .ob-plan-card.popular { border-color: #f97316; }
        .ob-popular-badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #f97316; color: #000; font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
        .ob-pc-name { font-weight: 700; font-size: 0.95rem; margin-bottom: 0.5rem; color: var(--c, #eae8f6); }
        .ob-pc-price { font-size: 1.5rem; font-weight: 800; color: #eae8f6; }
        .ob-pc-price span { font-size: 0.9rem; color: #7a7a9a; }
        .ob-pc-limit { font-size: 0.75rem; color: #7a7a9a; margin-top: 0.25rem; }
        .ob-pc-check { font-size: 0.8rem; color: #4ade80; font-weight: 700; margin-top: 0.5rem; opacity: 0; transition: opacity 0.2s; }
        .ob-pc-check.visible { opacity: 1; }
        .ob-plan-note { font-size: 0.85rem; color: #7a7a9a; background: rgba(255,255,255,0.04); border-radius: 8px; padding: 0.75rem 1rem; }
        .ob-review-card { background: #0d0d1f; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1.5rem; margin-bottom: 1.5rem; }
        .ob-review-section { padding: 0.75rem 0; }
        .ob-review-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #7a7a9a; margin-bottom: 0.3rem; }
        .ob-review-value { font-weight: 700; font-size: 1rem; }
        .ob-review-sub { font-size: 0.82rem; color: #7a7a9a; }
        .ob-review-divider { height: 1px; background: rgba(255,255,255,0.06); }
        .ob-trial-benefits { display: flex; flex-direction: column; gap: 0.5rem; }
        .ob-trial-item { font-size: 0.88rem; color: #4ade80; }
        .ob-error { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.88rem; color: #f87171; margin-bottom: 1rem; }
        .ob-form-footer { display: flex; gap: 1rem; margin-top: 2rem; align-items: center; }
        .ob-btn { padding: 0.85rem 1.75rem; border-radius: 10px; font-weight: 700; font-size: 0.95rem; text-decoration: none; cursor: pointer; border: none; font-family: inherit; transition: all 0.2s; }
        .ob-btn-gold { background: #f97316; color: #000; }
        .ob-btn-gold:hover { background: #ff9a2a; }
        .ob-btn-gold:disabled { opacity: 0.6; cursor: not-allowed; }
        .ob-btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #eae8f6; }
        .ob-btn-ghost:hover { background: rgba(255,255,255,0.06); }
        .ob-success { min-height: 100vh; background: #020209; display: flex; align-items: center; justify-content: center; padding: 2rem; }
        .ob-success-card { background: #0d0d1f; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 3rem; max-width: 520px; width: 100%; text-align: center; }
        .ob-success-icon { font-size: 3.5rem; margin-bottom: 1rem; }
        .ob-success-card h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.75rem; }
        .ob-success-card p { color: #7a7a9a; line-height: 1.7; margin-bottom: 1.5rem; font-size: 0.95rem; }
        .ob-success-next { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 2rem; text-align: left; }
        .ob-next-item { font-size: 0.88rem; color: #eae8f6; padding: 0.4rem 0; }
        .ob-success-actions { display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; }
        .ob-success-contact { font-size: 0.82rem; color: #7a7a9a; }
        @media (max-width: 768px) {
          .ob-body { flex-direction: column; }
          .ob-sidebar { width: 100%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 1.5rem; }
          .ob-main { padding: 1.5rem; }
          .ob-form-grid { grid-template-columns: 1fr; }
          .ob-field-full { grid-column: span 1; }
          .ob-plans { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
