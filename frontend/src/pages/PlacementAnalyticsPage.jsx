import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement,
} from 'chart.js';
import PageTransition from '../components/layout/PageTransition';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import {
  HiOutlineChartBar, HiOutlineDocumentArrowDown, HiOutlineBuildingOffice2,
  HiOutlineUsers, HiOutlineTrophy, HiOutlineArrowTrendingUp,
  HiOutlineCheckCircle, HiOutlineCurrencyRupee,
} from 'react-icons/hi2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const BRAND_COLORS = ['#f97316', '#6366f1', '#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4'];

const STATUS_COLORS = {
  scheduled: { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  ongoing:   { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  completed: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  cancelled: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
  },
};

function SummaryCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="glass-card-static" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} style={{ color }} />
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function injectPrintStyles() {
  const id = 'placement-print-style';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @media print {
      body > *:not(#placement-report-root) { display: none !important; }
      #placement-report-root { display: block !important; }
      .no-print { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

export default function PlacementAnalyticsPage() {
  const user = useAuthStore(s => s.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reportRef = useRef(null);

  useEffect(() => {
    const college_id = user?.college_id;
    api.get(`/analytics/placement${college_id ? `?college_id=${college_id}` : ''}`)
      .then(res => setData(res.data?.data || null))
      .catch(() => setErr('Could not load placement analytics.'))
      .finally(() => setLoading(false));
  }, [user]);

  const handlePrint = () => {
    injectPrintStyles();
    if (reportRef.current) reportRef.current.id = 'placement-report-root';
    window.print();
  };

  if (loading) return (
    <PageTransition>
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading placement analytics…</div>
    </PageTransition>
  );

  if (err || !data) return (
    <PageTransition>
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        {err || 'No placement data yet. Schedule drives and record offers to see analytics here.'}
      </div>
    </PageTransition>
  );

  const { summary, branch_breakdown, top_companies, timeline, drives } = data;

  // Branch bar chart
  const branchBarData = {
    labels: branch_breakdown.map(b => b.branch.length > 10 ? b.branch.slice(0, 10) + '…' : b.branch),
    datasets: [
      { label: 'Total', data: branch_breakdown.map(b => b.total_students), backgroundColor: 'rgba(249,115,22,0.2)', borderRadius: 4 },
      { label: 'Placed', data: branch_breakdown.map(b => b.placed_students), backgroundColor: '#f97316', borderRadius: 4 },
    ],
  };
  const branchBarOpts = {
    ...CHART_DEFAULTS,
    plugins: { ...CHART_DEFAULTS.plugins, legend: { display: true, labels: { color: '#9ca3af', font: { size: 11 } } } },
  };

  // Company doughnut
  const donutData = {
    labels: top_companies.slice(0, 7).map(c => c.company),
    datasets: [{
      data: top_companies.slice(0, 7).map(c => c.offers),
      backgroundColor: BRAND_COLORS.slice(0, top_companies.length),
      borderWidth: 0,
    }],
  };

  // Timeline bar
  const timelineData = {
    labels: timeline.map(t => t.month),
    datasets: [
      { label: 'Drives', data: timeline.map(t => t.drives), backgroundColor: 'rgba(99,102,241,0.5)', borderRadius: 4 },
      { label: 'Offers', data: timeline.map(t => t.offers), backgroundColor: '#f97316', borderRadius: 4 },
    ],
  };
  const timelineOpts = {
    ...CHART_DEFAULTS,
    plugins: { ...CHART_DEFAULTS.plugins, legend: { display: true, labels: { color: '#9ca3af', font: { size: 11 } } } },
  };

  return (
    <PageTransition>
      <div ref={reportRef}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HiOutlineChartBar size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Placement Analytics</h1>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                NAAC-ready report · {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}
              </p>
            </div>
          </div>
          <button className="no-print" onClick={handlePrint} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--brand-500)', color: '#fff',
            border: 'none', borderRadius: 10, padding: '10px 18px',
            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
          }}>
            <HiOutlineDocumentArrowDown size={17} /> Download PDF Report
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
          <SummaryCard icon={HiOutlineUsers} label="Total Students" value={summary.total_students.toLocaleString()} sub="in college" color="var(--brand-500)" />
          <SummaryCard icon={HiOutlineCheckCircle} label="Placed" value={summary.placed_students.toLocaleString()} sub={`${summary.placement_pct}% rate`} color="#10b981" />
          <SummaryCard icon={HiOutlineBuildingOffice2} label="Drives" value={summary.total_drives.toLocaleString()} sub="conducted" color="#06b6d4" />
          <SummaryCard icon={HiOutlineDocumentArrowDown} label="Offers" value={summary.total_offers.toLocaleString()} sub="letters issued" color="#a855f7" />
          <SummaryCard icon={HiOutlineCurrencyRupee} label="Avg Package" value={summary.avg_ctc ? `₹${summary.avg_ctc} LPA` : '—'} sub="average CTC" color="#f59e0b" />
          <SummaryCard icon={HiOutlineTrophy} label="Highest Package" value={summary.max_ctc ? `₹${summary.max_ctc} LPA` : '—'} sub="best offer" color="#a78bfa" />
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <div className="glass-card-static" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <HiOutlineBuildingOffice2 size={16} style={{ color: 'var(--brand-400)' }} /> Branch-wise Placement
            </h3>
            {branch_breakdown.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: '0.82rem' }}>No branch data yet</div>
            ) : (
              <div style={{ height: 220 }}>
                <Bar data={branchBarData} options={branchBarOpts} />
              </div>
            )}
          </div>
          <div className="glass-card-static" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <HiOutlineTrophy size={16} style={{ color: 'var(--brand-400)' }} /> Top Recruiting Companies
            </h3>
            {top_companies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: '0.82rem' }}>No offers recorded yet</div>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut data={donutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 11 }, boxWidth: 12, padding: 10 } } } }} />
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="glass-card-static" style={{ padding: '20px', marginBottom: 28 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <HiOutlineArrowTrendingUp size={16} style={{ color: 'var(--brand-400)' }} /> Drive Activity by Month
            </h3>
            <div style={{ height: 180 }}>
              <Bar data={timelineData} options={timelineOpts} />
            </div>
          </div>
        )}

        {/* Branch breakdown table */}
        <div className="glass-card-static" style={{ padding: '20px', marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Branch-wise Detailed Report
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Branch / Department', 'Total Students', 'Placed', 'Offers', 'Placement %'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branch_breakdown.map((b, i) => (
                  <tr key={b.branch} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{b.branch}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{b.total_students}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#10b981' }}>{b.placed_students}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{b.total_offers}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', minWidth: 50 }}>
                          <div style={{ height: '100%', width: `${b.placement_pct}%`, background: b.placement_pct >= 75 ? '#10b981' : b.placement_pct >= 50 ? '#f97316' : '#f59e0b', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: 32 }}>{b.placement_pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.04)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-primary)' }}>TOTAL</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>{summary.total_students}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: '#10b981' }}>{summary.placed_students}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>{summary.total_offers}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--brand-400)' }}>{summary.placement_pct}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Drives list */}
        {drives.length > 0 && (
          <div className="glass-card-static" style={{ padding: '20px', marginBottom: 28 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>All Drives</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.81rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Company', 'Role', 'Date', 'Branch', 'Status'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drives.map((d, i) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{d.company}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>{d.role}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>{new Date(d.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>{d.branch || 'All Branches'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          fontSize: '0.67rem', fontWeight: 700, padding: '3px 8px', borderRadius: 99, textTransform: 'capitalize',
                          color: (STATUS_COLORS[d.status] || STATUS_COLORS.scheduled).color,
                          background: (STATUS_COLORS[d.status] || STATUS_COLORS.scheduled).bg,
                        }}>{d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: '0.71rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Generated by Orbivex · {new Date().toLocaleString('en-IN')} · Confidential — for internal use only
        </div>
      </div>
    </PageTransition>
  );
}
