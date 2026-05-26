import { useState, useEffect } from 'react';
import { HiOutlineCpuChip } from 'react-icons/hi2';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import api from '../../lib/api';

const AGENT_TYPES = [
  { key: 'quiz', label: 'Quiz Generation', description: 'Auto-generate MCQ quizzes from lesson content' },
  { key: 'grading', label: 'Smart Grading', description: 'Automated rubric-based grading with feedback' },
  { key: 'plagiarism', label: 'Plagiarism Check', description: 'AI-powered assignment originality check' },
  { key: 'recommendation', label: 'Recommendations', description: 'Suggest next lessons based on progress' },
];

const MODELS = ['phi3', 'mistral'];

export default function AgentConfigPanel({ educatorId, addToast }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (educatorId) loadConfigs();
  }, [educatorId]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/educators/${educatorId}/agent-config`);
      setConfigs(res.data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const saveConfig = async (agentType, model, count) => {
    try {
      await api.post(`/admin/educators/${educatorId}/configure-agents`, {
        agent_type: agentType,
        model_name: model,
        agent_count: count,
      });
      addToast(`${agentType} agent configured`, 'success');
      loadConfigs();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  if (loading) return <div className="text-muted" style={{ padding: '12px' }}>Loading agent config...</div>;

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <HiOutlineCpuChip size={20} style={{ color: 'var(--primary-500)' }} />
        <h4 style={{ margin: 0 }}>AI Agent Configuration</h4>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {AGENT_TYPES.map((agent) => {
          const existing = configs.find((c) => c.agent_type === agent.key);
          const currentModel = existing?.model_name || 'phi3';
          const currentCount = existing?.agent_count || 1;

          return (
            <div key={agent.key} className="glass-card-static" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong>{agent.label}</strong>
                {existing?.is_active && <Badge variant="success">Active</Badge>}
              </div>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>{agent.description}</p>

              <div style={{ marginBottom: '8px' }}>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Model</label>
                <select
                  className="admin-select"
                  value={currentModel}
                  onChange={(e) => saveConfig(agent.key, e.target.value, currentCount)}
                  style={{ fontSize: '0.85rem' }}
                >
                  {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Parallel Agents: {currentCount}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={currentCount}
                  onChange={(e) => saveConfig(agent.key, currentModel, parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--primary-500)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }} className="text-muted">
                  <span>1</span><span>5</span><span>10</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
