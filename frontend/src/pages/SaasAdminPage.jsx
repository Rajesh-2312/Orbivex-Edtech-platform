/**
 * Orbivex SaaS Admin Portal — Revenue & Tenant Management
 * For founder/super-admin use only. Shows MRR, ARR, all colleges, billing health.
 * Access: /saas-admin (requires SUPER_ADMIN email)
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../lib/api';

const PLAN_COLORS = { starter: '#6366f1', growth: '#f97316', enterprise: '#22d3ee' };
const STATUS_COLORS = { active: '#4ade80', trialing: '#f59e0b', cancelled: '#f87171', expired: '#ef4444', cancel_at_period_end: '#fb923c' };

function MetricCard({ label, value, sub, color, prefix = '' }) {
  return (
    <motion.div className="sa-metric" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="sa-metric-label">{label}</div>
      <div className="sa-metric-value" style={{ color }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </div>
      {sub && <div className="sa-metric-sub">{sub}</div>}
    </motion.div>
  );
}

function CollegeRow({ sub, onContact }) {
  const plan = sub.plan_id;
  const status = sub.status;
  const college = sub.colleges;
  const daysLeft = sub.current_period_end
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <tr className="sa-row">
      <td>
        <div className="sa-col-name">{college?.name || 'Unknown'}</div>
        <div className="sa-col-code">{college?.code || '—'}</div>
      </td>
      <td>
        <span className="sa-badge" style={{ background: `${PLAN_COLORS[plan]}22`, color: PLAN_COLORS[plan] }}>
          {plan?.charAt(0).toUpperCase() + plan?.slice(1) || '—'}
        </span>
      </td>
      <td>
        <span className="sa-badge" style={{ background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status] }}>
          {status?.replace(/_/g, ' ')}
        </span>
      </td>
      <td>
        ₹{plan === 'starter' ? '8,000' : plan === 'growth' ? '15,000' : '25,000'}
        <span className="sa-cycle">/{sub.billing_cycle === 'annual' ? 'yr÷12' : 'mo'}</span>
      </td>
      <td>
        <div className={`sa-days ${daysLeft <= 3 ? 'warn' : ''}`}>{daysLeft}d left</div>
      </td>
      <td>{new Date(sub.created_at).toLocaleDateString('en-IN')}</td>
      <td>
        <button className="sa-action-btn" onClick={() => onContact(sub)}>Contact</button>
      </td>
    </tr>
  );
}

function DemoRequestsPanel({ requests }) {
  if (!requests?.length) return <div className="sa-empty">No demo requests yet.</div>;
  return (
    <div className="sa-demo-list">
      {requests.map((r, i) => (
        <div key={i} className="sa-demo-item">
          <div>
            <div className="sa-demo-name">{r.name}</div>
            <div className="sa-demo-college">{r.college_name}</div>
          </div>
          <div>
            <div className="sa-demo-contact">{r.email}</div>
            <div className="sa-demo-contact">{r.phone}</div>
          </div>
          <div>
            <span className="sa-badge" style={{ background: '#f97316', color: '#000' }}>{r.plan_interest}</span>
            <div className="sa-demo-students">{r.student_count}</div>
          </div>
          <div>
            <span className={`sa-status-dot ${r.status}`}>{r.status}</span>
            <div className="sa-demo-date">{new Date(r.created_at).toLocaleDateString('en-IN')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SaasAdminPage() {
  const [metrics, setMetrics] = useState(null);
  const [demoRequests, setDemoRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [contactModal, setContactModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsRes, demosRes] = await Promise.all([
        api.get('/billing/saas-metrics'),
        api.get('/admin/demo-requests').catch(() => ({ data: { data: [] } })),
      ]);
      if (metricsRes.data.success) setMetrics(metricsRes.data.data);
      if (demosRes.data.success) setDemoRequests(demosRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const targetMRR = 100000; // ₹1 Lakh

  if (loading) {
    return (
      <div className="sa-loading">
        <div className="sa-spinner" />
        <div>Loading revenue dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sa-error">
        <div>⚠️ {error}</div>
        <button onClick={loadData}>Retry</button>
      </div>
    );
  }

  const mrrProgress = metrics ? (metrics.mrr / targetMRR) * 100 : 0;

  return (
    <div className="sa">
      {/* Header */}
      <div className="sa-header">
        <div className="sa-header-left">
          <div className="sa-brand">
            <div className="sa-mark">O</div>
            <div>
              <div className="sa-title">Orbivex Revenue Hub</div>
              <div className="sa-subtitle">Super Admin · Founder View</div>
            </div>
          </div>
        </div>
        <div className="sa-header-right">
          <button className="sa-refresh-btn" onClick={loadData}>↻ Refresh</button>
          <div className="sa-date">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {/* MRR Progress Bar — ₹1L Target */}
      <div className="sa-mrr-banner">
        <div className="sa-mrr-label">
          <span>Monthly Recurring Revenue</span>
          <span className="sa-mrr-target">Target: ₹1,00,000/month</span>
        </div>
        <div className="sa-mrr-bar-wrap">
          <div className="sa-mrr-bar">
            <motion.div
              className="sa-mrr-fill"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(mrrProgress, 100)}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="sa-mrr-pct">{mrrProgress.toFixed(1)}% of target</div>
        </div>
        <div className="sa-mrr-values">
          <div className="sa-mrr-current">₹{(metrics?.mrr || 0).toLocaleString('en-IN')} MRR</div>
          <div className="sa-mrr-gap">₹{Math.max(0, targetMRR - (metrics?.mrr || 0)).toLocaleString('en-IN')} to go</div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="sa-metrics-grid">
        <MetricCard label="Monthly Recurring Revenue" value={metrics?.mrr || 0} prefix="₹" sub={`ARR: ₹${((metrics?.mrr || 0) * 12).toLocaleString('en-IN')}`} color="#f97316" />
        <MetricCard label="Active Colleges" value={metrics?.active_count || 0} sub="Paying subscribers" color="#4ade80" />
        <MetricCard label="On Trial" value={metrics?.trial_count || 0} sub="14-day free trial" color="#f59e0b" />
        <MetricCard label="Cancelled" value={metrics?.cancelled_count || 0} sub="All time churn" color="#f87171" />
        <MetricCard label="Total Colleges" value={metrics?.total_colleges || 0} sub="All tenants" color="#22d3ee" />
        <MetricCard label="Avg Revenue / College" value={metrics?.active_count ? Math.round(metrics.mrr / metrics.active_count) : 0} prefix="₹" sub="ARPC" color="#a78bfa" />
      </div>

      {/* Plan Breakdown */}
      <div className="sa-plan-breakdown">
        <div className="sa-section-title">Plan Distribution</div>
        <div className="sa-plan-bars">
          {Object.entries(metrics?.plan_breakdown || {}).map(([plan, count]) => {
            const total = metrics?.active_count || 1;
            const pct = (count / total) * 100;
            const revenue = count * (plan === 'starter' ? 8000 : plan === 'growth' ? 15000 : 25000);
            return (
              <div key={plan} className="sa-plan-bar-item">
                <div className="sa-plan-bar-header">
                  <span style={{ color: PLAN_COLORS[plan], fontWeight: 700 }}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
                  <span className="sa-plan-count">{count} colleges · ₹{revenue.toLocaleString('en-IN')}/mo</span>
                </div>
                <div className="sa-plan-bar-track">
                  <motion.div
                    className="sa-plan-bar-fill"
                    style={{ background: PLAN_COLORS[plan] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="sa-tabs">
        {[{ id: 'overview', label: 'All Colleges' }, { id: 'demos', label: `Demo Requests (${demoRequests.length})` }, { id: 'revenue', label: 'Revenue Calculator' }].map(t => (
          <button key={t.id} className={`sa-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="sa-table-wrap">
          {!metrics?.subscriptions?.length ? (
            <div className="sa-empty">No colleges onboarded yet. Share the landing page to get your first customer!</div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>College</th><th>Plan</th><th>Status</th><th>MRR</th><th>Period</th><th>Joined</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {metrics.subscriptions.map((sub, i) => (
                  <CollegeRow key={i} sub={sub} onContact={setContactModal} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'demos' && (
        <div className="sa-panel">
          <div className="sa-section-title">Demo Requests — Unconverted Leads</div>
          <DemoRequestsPanel requests={demoRequests} />
        </div>
      )}

      {tab === 'revenue' && (
        <div className="sa-panel">
          <div className="sa-section-title">₹1 Lakh/Month Roadmap</div>
          <div className="sa-roadmap">
            {[
              { scenario: 'Conservative', combos: '4 Starter + 3 Growth + 0 Enterprise', mrr: 4 * 8000 + 3 * 15000, colleges: 7 },
              { scenario: 'Target', combos: '2 Starter + 5 Growth + 1 Enterprise', mrr: 2 * 8000 + 5 * 15000 + 1 * 25000, colleges: 8 },
              { scenario: 'Growth', combos: '0 Starter + 6 Growth + 2 Enterprise', mrr: 6 * 15000 + 2 * 25000, colleges: 8 },
              { scenario: 'Scale', combos: '0 Starter + 0 Growth + 4 Enterprise', mrr: 4 * 25000, colleges: 4 },
            ].map((s, i) => (
              <div key={i} className={`sa-scenario ${s.mrr >= 100000 ? 'achieved' : ''}`}>
                <div className="sa-scenario-name">{s.scenario}</div>
                <div className="sa-scenario-combo">{s.combos}</div>
                <div className="sa-scenario-mrr" style={{ color: s.mrr >= 100000 ? '#4ade80' : '#f97316' }}>
                  ₹{s.mrr.toLocaleString('en-IN')}/mo
                </div>
                <div className="sa-scenario-colleges">{s.colleges} colleges needed</div>
                {s.mrr >= 100000 && <div className="sa-scenario-badge">✓ Hits ₹1L target</div>}
              </div>
            ))}
          </div>
          <div className="sa-action-items">
            <div className="sa-section-title" style={{ marginTop: '2rem' }}>Weekly Action Items</div>
            {['Call 5 engineering colleges in AP/Telangana this week', 'Follow up on all pending demo requests within 24h', 'Post on LinkedIn about AI quiz generation feature', 'Collect 2 testimonials from existing trial colleges', 'Send "Trial ending" reminders to colleges on day 10', 'Offer 1 month free for annual commitment (closes deals faster)'].map((item, i) => (
              <div key={i} className="sa-action-item">
                <input type="checkbox" id={`action-${i}`} />
                <label htmlFor={`action-${i}`}>{item}</label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {contactModal && (
        <div className="sa-modal-overlay" onClick={() => setContactModal(null)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <h3>{contactModal.colleges?.name}</h3>
            <p>Plan: <strong>{contactModal.plan_id}</strong> · Status: <strong>{contactModal.status}</strong></p>
            <div className="sa-modal-actions">
              <a href={`mailto:${contactModal.admin_email}`} className="sa-btn">Email Admin</a>
              <button className="sa-btn sa-btn-ghost" onClick={() => setContactModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sa { min-height: 100vh; background: #020209; color: #eae8f6; font-family: 'Outfit', system-ui, sans-serif; }
        .sa-loading, .sa-error { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 1rem; color: #7a7a9a; }
        .sa-spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #f97316; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .sa-header { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem 2.5rem; border-bottom: 1px solid rgba(255,255,255,0.06); background: #07070f; }
        .sa-header-left { display: flex; align-items: center; }
        .sa-brand { display: flex; align-items: center; gap: 0.75rem; }
        .sa-mark { width: 40px; height: 40px; background: linear-gradient(135deg, #f97316, #6366f1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 1.2rem; }
        .sa-title { font-size: 1.1rem; font-weight: 800; }
        .sa-subtitle { font-size: 0.75rem; color: #7a7a9a; }
        .sa-header-right { display: flex; align-items: center; gap: 1rem; }
        .sa-refresh-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #eae8f6; padding: 0.5rem 0.9rem; cursor: pointer; font-size: 0.85rem; font-family: inherit; }
        .sa-date { font-size: 0.8rem; color: #7a7a9a; }
        .sa-mrr-banner { padding: 1.75rem 2.5rem; background: linear-gradient(135deg, rgba(249,115,22,0.08), rgba(99,102,241,0.06)); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .sa-mrr-label { display: flex; justify-content: space-between; font-size: 0.82rem; color: #7a7a9a; margin-bottom: 0.6rem; }
        .sa-mrr-target { font-weight: 600; }
        .sa-mrr-bar-wrap { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
        .sa-mrr-bar { flex: 1; height: 10px; background: rgba(255,255,255,0.08); border-radius: 5px; overflow: hidden; }
        .sa-mrr-fill { height: 100%; background: linear-gradient(90deg, #f97316, #6366f1); border-radius: 5px; }
        .sa-mrr-pct { font-size: 0.82rem; color: #7a7a9a; white-space: nowrap; }
        .sa-mrr-values { display: flex; justify-content: space-between; }
        .sa-mrr-current { font-size: 1.5rem; font-weight: 800; color: #f97316; }
        .sa-mrr-gap { font-size: 0.85rem; color: #7a7a9a; align-self: center; }
        .sa-metrics-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .sa-metric { padding: 1.5rem 1.75rem; border-right: 1px solid rgba(255,255,255,0.06); }
        .sa-metric:last-child { border-right: none; }
        .sa-metric-label { font-size: 0.75rem; color: #7a7a9a; margin-bottom: 0.4rem; }
        .sa-metric-value { font-size: 1.8rem; font-weight: 800; }
        .sa-metric-sub { font-size: 0.72rem; color: #7a7a9a; margin-top: 0.2rem; }
        .sa-plan-breakdown { padding: 1.75rem 2.5rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .sa-section-title { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #7a7a9a; margin-bottom: 1.25rem; }
        .sa-plan-bars { display: flex; flex-direction: column; gap: 0.85rem; }
        .sa-plan-bar-item {}
        .sa-plan-bar-header { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.35rem; }
        .sa-plan-count { color: #7a7a9a; }
        .sa-plan-bar-track { height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
        .sa-plan-bar-fill { height: 100%; border-radius: 4px; }
        .sa-tabs { display: flex; padding: 0 2.5rem; border-bottom: 1px solid rgba(255,255,255,0.06); gap: 0; }
        .sa-tab { background: none; border: none; color: #7a7a9a; padding: 1rem 1.25rem; cursor: pointer; font-size: 0.88rem; font-family: inherit; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .sa-tab.active { color: #f97316; border-bottom-color: #f97316; }
        .sa-table-wrap { padding: 2rem 2.5rem; overflow-x: auto; }
        .sa-table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .sa-table th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: #7a7a9a; padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .sa-row td { padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.88rem; }
        .sa-row:hover td { background: rgba(255,255,255,0.02); }
        .sa-col-name { font-weight: 600; }
        .sa-col-code { font-size: 0.75rem; color: #7a7a9a; }
        .sa-badge { padding: 3px 9px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; }
        .sa-cycle { font-size: 0.72rem; color: #7a7a9a; }
        .sa-days { font-size: 0.82rem; }
        .sa-days.warn { color: #f59e0b; font-weight: 700; }
        .sa-action-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #eae8f6; padding: 0.35rem 0.75rem; cursor: pointer; font-size: 0.8rem; font-family: inherit; }
        .sa-empty { padding: 3rem; text-align: center; color: #7a7a9a; font-size: 0.9rem; }
        .sa-panel { padding: 2rem 2.5rem; }
        .sa-demo-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .sa-demo-item { display: grid; grid-template-columns: 2fr 2fr 1fr 1fr; gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); align-items: center; }
        .sa-demo-name { font-weight: 600; font-size: 0.9rem; }
        .sa-demo-college { font-size: 0.78rem; color: #7a7a9a; }
        .sa-demo-contact { font-size: 0.82rem; color: #eae8f6; }
        .sa-demo-students { font-size: 0.75rem; color: #7a7a9a; }
        .sa-demo-date { font-size: 0.75rem; color: #7a7a9a; }
        .sa-status-dot { font-size: 0.75rem; font-weight: 600; color: #f59e0b; }
        .sa-roadmap { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .sa-scenario { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; }
        .sa-scenario.achieved { border-color: rgba(74,222,128,0.3); background: rgba(74,222,128,0.05); }
        .sa-scenario-name { font-weight: 700; margin-bottom: 0.4rem; }
        .sa-scenario-combo { font-size: 0.78rem; color: #7a7a9a; margin-bottom: 0.75rem; line-height: 1.5; }
        .sa-scenario-mrr { font-size: 1.5rem; font-weight: 800; }
        .sa-scenario-colleges { font-size: 0.75rem; color: #7a7a9a; }
        .sa-scenario-badge { font-size: 0.75rem; color: #4ade80; font-weight: 600; margin-top: 0.4rem; }
        .sa-action-items { display: flex; flex-direction: column; gap: 0.5rem; }
        .sa-action-item { display: flex; align-items: center; gap: 0.75rem; font-size: 0.88rem; }
        .sa-action-item label { cursor: pointer; color: #eae8f6; }
        .sa-modal-overlay { position: fixed; inset: 0; background: rgba(2,2,9,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .sa-modal { background: #0d0d1f; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 2rem; max-width: 400px; width: 90%; }
        .sa-modal h3 { font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem; }
        .sa-modal p { font-size: 0.88rem; color: #7a7a9a; margin-bottom: 1.5rem; }
        .sa-modal-actions { display: flex; gap: 0.75rem; }
        .sa-btn { padding: 0.7rem 1.2rem; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; font-family: inherit; text-decoration: none; background: #f97316; color: #000; border: none; }
        .sa-btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #eae8f6; }
        @media (max-width: 1024px) {
          .sa-metrics-grid { grid-template-columns: repeat(3, 1fr); }
          .sa-roadmap { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .sa-metrics-grid { grid-template-columns: 1fr 1fr; }
          .sa-demo-item { grid-template-columns: 1fr; }
          .sa-roadmap { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
