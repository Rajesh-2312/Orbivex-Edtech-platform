import { useEffect, useRef } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export function CompletionDoughnut({ completed, total }) {
  const remaining = Math.max(total - completed, 0);

  const data = {
    labels: ['Completed', 'Remaining'],
    datasets: [{
      data: [completed, remaining],
      backgroundColor: ['#6366f1', '#1a1a24'],
      borderColor: ['#818cf8', '#2a2a3a'],
      borderWidth: 2,
      cutout: '75%',
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a24',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(99,102,241,0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
  };

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: '200px' }}>
      <Doughnut data={data} options={options} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        textAlign: 'center',
      }}>
        <div style={{ font: '700 2rem/1 var(--font-display)', color: 'var(--text-primary)' }}>{percentage}%</div>
        <div style={{ font: '400 0.75rem/1 var(--font-body)', color: 'var(--text-muted)' }}>complete</div>
      </div>
    </div>
  );
}

export function WeeklyProgressBar({ data: weeklyData }) {
  const labels = weeklyData?.map(d => d.day) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const values = weeklyData?.map(d => d.count) || [0, 0, 0, 0, 0, 0, 0];

  const data = {
    labels,
    datasets: [{
      label: 'Lessons Completed',
      data: values,
      backgroundColor: 'rgba(99,102,241,0.6)',
      borderColor: '#6366f1',
      borderWidth: 1,
      borderRadius: 6,
      maxBarThickness: 32,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a24',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(99,102,241,0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(148,163,184,0.06)' },
        ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 },
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{ width: '100%', height: '200px' }}>
      <Bar data={data} options={options} />
    </div>
  );
}
