import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

// ── Styles ─────────────────────────────────────────────────────────
const S = {
  page: {
    padding: '24px 32px',
    minHeight: '100vh',
    color: 'var(--text-primary)',
    fontFamily: "'Outfit', sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28,
  },
  headerIcon: {
    width: 48, height: 48, borderRadius: 14,
    background: 'linear-gradient(135deg, #10b981, #059669)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, flexShrink: 0,
  },
  title:    { fontSize: 26, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 14, color: 'var(--text-secondary)', margin: '2px 0 0' },
  layout: {
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    gap: 24,
    alignItems: 'start',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 15, fontWeight: 600, margin: 0 },
  cardBody: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: 600, color: '#a5b4fc',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 12,
  },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 },
  input: {
    width: '100%', padding: '9px 14px',
    borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Outfit', sans-serif",
  },
  textarea: {
    width: '100%', padding: '9px 14px', minHeight: 80,
    borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
    resize: 'vertical', boxSizing: 'border-box',
    fontFamily: "'Outfit', sans-serif",
  },
  btn: (v) => ({
    padding: '9px 18px', borderRadius: 10, border: 'none',
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
    fontFamily: "'Outfit', sans-serif",
    background:
      v === 'primary' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
      : v === 'success' ? 'linear-gradient(135deg,#10b981,#059669)'
      : v === 'ghost'  ? 'rgba(255,255,255,0.06)'
      : 'rgba(99,102,241,0.15)',
    color:
      v === 'primary' ? '#fff'
      : v === 'success' ? '#fff'
      : v === 'ghost'  ? 'var(--text-secondary)'
      : '#a5b4fc',
    transition: 'opacity 0.18s',
  }),
  aiBullet: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '10px 14px', borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    marginBottom: 8, cursor: 'pointer',
    transition: 'background 0.15s',
  },
  previewPage: {
    background: '#ffffff',
    color: '#1a1a1a',
    borderRadius: 10,
    padding: '40px 48px',
    minHeight: 800,
    fontFamily: "'Georgia', serif",
    boxShadow: '0 4px 40px rgba(0,0,0,0.4)',
    position: 'sticky',
    top: 80,
  },
};

const SKILL_OPTIONS = [
  'Java', 'Python', 'C++', 'JavaScript', 'React', 'Node.js',
  'Spring Boot', 'SQL', 'MongoDB', 'Docker', 'Git', 'AWS',
  'Machine Learning', 'Data Structures', 'System Design', 'REST APIs',
];

const COMPANY_TYPES = ['product', 'service', 'startup', 'finance', 'core'];

const EMPTY_RESUME = {
  personal: { name: '', email: '', phone: '', linkedin: '', github: '', location: '' },
  summary: '',
  education: [{ degree: '', college: '', cgpa: '', year: '' }],
  experience: [{ role: '', company: '', duration: '', bullets: [] }],
  projects:   [{ name: '', tech: '', description: '', bullets: [] }],
  skills: { languages: [], frameworks: [], tools: [], databases: [] },
  achievements: [''],
  certifications: [{ name: '', issuer: '', year: '' }],
};

export default function ResumeBuilderPage() {
  const user                  = useAuthStore(s => s.user);
  const [resume, setResume]   = useState(() => structuredClone(EMPTY_RESUME));
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [aiLoading, setAiLoading] = useState({});
  const [companyType, setCompanyType] = useState('product');
  const previewRef = useRef(null);

  // Pre-fill from profile
  useEffect(() => {
    if (user) {
      setResume(r => ({
        ...r,
        personal: { ...r.personal, name: user.display_name || '', email: user.email || '' },
      }));
    }
    // Load saved resume
    api.get('/resume').then(res => {
      if (res.data.data?.resume?.resume_json) {
        setResume(res.data.data.resume.resume_json);
      }
    }).catch(() => {});
  }, [user]);

  // ── Helpers ─────────────────────────────────────────────────
  const set = (path, value) => {
    setResume(prev => {
      const next  = structuredClone(prev);
      const parts = path.split('.');
      let   obj   = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return next;
    });
    setSaved(false);
  };

  const setArrayItem = (key, idx, field, value) => {
    setResume(prev => {
      const next  = structuredClone(prev);
      next[key][idx][field] = value;
      return next;
    });
    setSaved(false);
  };

  const addArrayItem = (key, template) => {
    setResume(prev => ({ ...prev, [key]: [...prev[key], structuredClone(template)] }));
  };

  const removeArrayItem = (key, idx) => {
    setResume(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  const toggleSkill = (category, skill) => {
    setResume(prev => {
      const next = structuredClone(prev);
      const arr  = next.skills[category];
      next.skills[category] = arr.includes(skill)
        ? arr.filter(s => s !== skill)
        : [...arr, skill];
      return next;
    });
    setSaved(false);
  };

  // ── AI actions ───────────────────────────────────────────────
  const generateBullets = async (type, idx) => {
    const key = `${type}_${idx}`;
    setAiLoading(l => ({ ...l, [key]: true }));
    try {
      const item  = resume[type][idx];
      const desc  = item.description || item.duration || '';
      const role  = item.role || item.name || '';
      const skills = [
        ...resume.skills.languages,
        ...resume.skills.frameworks,
        ...(item.tech ? [item.tech] : []),
      ].join(', ');

      const res = await api.post('/resume/generate-bullets', {
        role, experience_desc: desc || `${role} at ${item.company || 'project'}`,
        skills, company_type: companyType,
      });

      const bullets = res.data.data?.bullets || [];
      setResume(prev => {
        const next = structuredClone(prev);
        next[type][idx].bullets = bullets;
        return next;
      });
      setSaved(false);
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(l => ({ ...l, [key]: false }));
    }
  };

  const generateSummary = async () => {
    setAiLoading(l => ({ ...l, summary: true }));
    try {
      const res = await api.post('/resume/generate-summary', {
        name  : resume.personal.name,
        role  : resume.experience[0]?.role || 'Software Developer',
        skills: [...resume.skills.languages, ...resume.skills.frameworks],
        cgpa  : resume.education[0]?.cgpa,
        college: resume.education[0]?.college,
        year_of_passing: resume.education[0]?.year,
      });
      set('summary', res.data.data?.summary || '');
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(l => ({ ...l, summary: false }));
    }
  };

  // ── Save ─────────────────────────────────────────────────────
  const saveResume = async () => {
    setSaving(true);
    try {
      await api.post('/resume/save', {
        resume_json: resume,
        title: `${resume.personal.name || 'My'} Resume`,
      });
      setSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Print/PDF ─────────────────────────────────────────────────
  const exportPDF = () => {
    window.print();
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Print-only styles injected */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .resume-preview { display: block !important; }
        }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerIcon}>📄</div>
        <div>
          <h1 style={S.title}>AI Resume Builder</h1>
          <p style={S.subtitle}>ATS-optimized resume with AI bullet generation for Indian placements</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={companyType}
            onChange={e => setCompanyType(e.target.value)}
            style={{ ...S.input, width: 'auto', padding: '8px 14px' }}
          >
            {COMPANY_TYPES.map(c => <option key={c} value={c}>{c} company</option>)}
          </select>
          <button style={S.btn('ghost')} onClick={exportPDF}>🖨️ Print / PDF</button>
          <button style={S.btn('success')} onClick={saveResume} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✅ Saved' : '💾 Save'}
          </button>
        </div>
      </div>

      <div style={S.layout}>
        {/* ── LEFT: Form ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Personal Info */}
          <div style={S.card}>
            <div style={S.cardHeader}><p style={S.cardTitle}>👤 Personal Info</p></div>
            <div style={S.cardBody}>
              {[
                ['personal.name',     'Full Name'],
                ['personal.email',    'Email'],
                ['personal.phone',    'Phone'],
                ['personal.location', 'Location (City, State)'],
                ['personal.linkedin', 'LinkedIn URL'],
                ['personal.github',   'GitHub URL'],
              ].map(([path, label]) => (
                <div key={path} style={S.field}>
                  <label style={S.label}>{label}</label>
                  <input
                    style={S.input}
                    value={path.split('.').reduce((o, k) => o?.[k], resume) || ''}
                    onChange={e => set(path, e.target.value)}
                    placeholder={label}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <p style={S.cardTitle}>✍️ Professional Summary</p>
              <button style={S.btn('ai')} onClick={generateSummary} disabled={aiLoading.summary}>
                {aiLoading.summary ? '🤖 Generating…' : '🤖 AI Generate'}
              </button>
            </div>
            <div style={S.cardBody}>
              <textarea
                style={S.textarea}
                value={resume.summary}
                onChange={e => set('summary', e.target.value)}
                placeholder="Professional summary (3 sentences, AI can write this for you)"
                rows={4}
              />
            </div>
          </div>

          {/* Education */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <p style={S.cardTitle}>🎓 Education</p>
              <button style={S.btn('ghost')} onClick={() => addArrayItem('education', { degree: '', college: '', cgpa: '', year: '' })}>+ Add</button>
            </div>
            <div style={S.cardBody}>
              {resume.education.map((edu, idx) => (
                <div key={idx} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: idx < resume.education.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  {[['degree', 'Degree (e.g. B.Tech CSE)'], ['college', 'College Name'], ['cgpa', 'CGPA / %'], ['year', 'Year of Passing']].map(([f, l]) => (
                    <div key={f} style={S.field}>
                      <label style={S.label}>{l}</label>
                      <input style={S.input} value={edu[f] || ''} onChange={e => setArrayItem('education', idx, f, e.target.value)} placeholder={l} />
                    </div>
                  ))}
                  {resume.education.length > 1 && (
                    <button style={{ ...S.btn('ghost'), fontSize: 12 }} onClick={() => removeArrayItem('education', idx)}>Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Experience */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <p style={S.cardTitle}>💼 Experience / Internships</p>
              <button style={S.btn('ghost')} onClick={() => addArrayItem('experience', { role: '', company: '', duration: '', bullets: [] })}>+ Add</button>
            </div>
            <div style={S.cardBody}>
              {resume.experience.map((exp, idx) => (
                <div key={idx} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: idx < resume.experience.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  {[['role', 'Role / Title'], ['company', 'Company'], ['duration', 'Duration (e.g. Jun 2024 – Aug 2024)']].map(([f, l]) => (
                    <div key={f} style={S.field}>
                      <label style={S.label}>{l}</label>
                      <input style={S.input} value={exp[f] || ''} onChange={e => setArrayItem('experience', idx, f, e.target.value)} placeholder={l} />
                    </div>
                  ))}
                  <div style={S.field}>
                    <label style={S.label}>Description (used for AI generation)</label>
                    <textarea style={S.textarea} value={exp.description || ''} onChange={e => setArrayItem('experience', idx, 'description', e.target.value)} placeholder="Describe what you did…" rows={3} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={S.label}>Bullet Points</label>
                    <button style={S.btn('ai')} onClick={() => generateBullets('experience', idx)} disabled={aiLoading[`experience_${idx}`]}>
                      {aiLoading[`experience_${idx}`] ? '🤖 Generating…' : '🤖 AI Bullets'}
                    </button>
                  </div>
                  {(exp.bullets || []).map((b, bi) => (
                    <div key={bi} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <input style={{ ...S.input, fontSize: 13 }} value={b} onChange={e => {
                        setResume(prev => {
                          const next = structuredClone(prev);
                          next.experience[idx].bullets[bi] = e.target.value;
                          return next;
                        });
                      }} />
                      <button style={{ ...S.btn('ghost'), padding: '6px 10px', flexShrink: 0 }} onClick={() => {
                        setResume(prev => {
                          const next = structuredClone(prev);
                          next.experience[idx].bullets.splice(bi, 1);
                          return next;
                        });
                      }}>✕</button>
                    </div>
                  ))}
                  <button style={{ ...S.btn('ghost'), fontSize: 12, marginTop: 4 }} onClick={() => {
                    setResume(prev => {
                      const next = structuredClone(prev);
                      next.experience[idx].bullets.push('');
                      return next;
                    });
                  }}>+ Add bullet</button>
                  {resume.experience.length > 1 && (
                    <div style={{ marginTop: 10 }}>
                      <button style={{ ...S.btn('ghost'), fontSize: 12 }} onClick={() => removeArrayItem('experience', idx)}>Remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Projects */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <p style={S.cardTitle}>🚀 Projects</p>
              <button style={S.btn('ghost')} onClick={() => addArrayItem('projects', { name: '', tech: '', description: '', bullets: [] })}>+ Add</button>
            </div>
            <div style={S.cardBody}>
              {resume.projects.map((proj, idx) => (
                <div key={idx} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: idx < resume.projects.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  {[['name', 'Project Name'], ['tech', 'Tech Stack']].map(([f, l]) => (
                    <div key={f} style={S.field}>
                      <label style={S.label}>{l}</label>
                      <input style={S.input} value={proj[f] || ''} onChange={e => setArrayItem('projects', idx, f, e.target.value)} placeholder={l} />
                    </div>
                  ))}
                  <div style={S.field}>
                    <label style={S.label}>Description</label>
                    <textarea style={S.textarea} value={proj.description || ''} onChange={e => setArrayItem('projects', idx, 'description', e.target.value)} placeholder="What does the project do?" rows={2} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={S.label}>Bullet Points</label>
                    <button style={S.btn('ai')} onClick={() => generateBullets('projects', idx)} disabled={aiLoading[`projects_${idx}`]}>
                      {aiLoading[`projects_${idx}`] ? '🤖 Generating…' : '🤖 AI Bullets'}
                    </button>
                  </div>
                  {(proj.bullets || []).map((b, bi) => (
                    <div key={bi} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <input style={{ ...S.input, fontSize: 13 }} value={b} onChange={e => {
                        setResume(prev => {
                          const next = structuredClone(prev);
                          next.projects[idx].bullets[bi] = e.target.value;
                          return next;
                        });
                      }} />
                      <button style={{ ...S.btn('ghost'), padding: '6px 10px', flexShrink: 0 }} onClick={() => {
                        setResume(prev => {
                          const next = structuredClone(prev);
                          next.projects[idx].bullets.splice(bi, 1);
                          return next;
                        });
                      }}>✕</button>
                    </div>
                  ))}
                  <button style={{ ...S.btn('ghost'), fontSize: 12, marginTop: 4 }} onClick={() => {
                    setResume(prev => {
                      const next = structuredClone(prev);
                      next.projects[idx].bullets.push('');
                      return next;
                    });
                  }}>+ Add bullet</button>
                  {resume.projects.length > 1 && (
                    <div style={{ marginTop: 10 }}>
                      <button style={{ ...S.btn('ghost'), fontSize: 12 }} onClick={() => removeArrayItem('projects', idx)}>Remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div style={S.card}>
            <div style={S.cardHeader}><p style={S.cardTitle}>🛠️ Technical Skills</p></div>
            <div style={S.cardBody}>
              {[
                ['languages', 'Languages', ['Java', 'Python', 'C++', 'JavaScript', 'C', 'Go', 'Rust']],
                ['frameworks', 'Frameworks / Libraries', ['React', 'Node.js', 'Spring Boot', 'Django', 'Flask', 'Express', 'Angular', 'Vue']],
                ['tools', 'Tools & Platforms', ['Git', 'Docker', 'AWS', 'Linux', 'Kubernetes', 'Jenkins', 'Postman']],
                ['databases', 'Databases', ['SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase']],
              ].map(([cat, label, options]) => (
                <div key={cat} style={S.field}>
                  <label style={S.label}>{label}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {options.map(skill => {
                      const active = resume.skills[cat].includes(skill);
                      return (
                        <button
                          key={skill}
                          onClick={() => toggleSkill(cat, skill)}
                          style={{
                            padding: '4px 12px', borderRadius: 20, fontSize: 13,
                            border: `1px solid ${active ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                            background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
                            color: active ? '#a5b4fc' : 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >{skill}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <p style={S.cardTitle}>🏆 Achievements</p>
              <button style={S.btn('ghost')} onClick={() => setResume(prev => ({ ...prev, achievements: [...prev.achievements, ''] }))}>+ Add</button>
            </div>
            <div style={S.cardBody}>
              {resume.achievements.map((ach, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input style={S.input} value={ach} placeholder="e.g. Ranked 45 in TCS NQT (2024)" onChange={e => {
                    setResume(prev => {
                      const next = structuredClone(prev);
                      next.achievements[idx] = e.target.value;
                      return next;
                    });
                  }} />
                  <button style={{ ...S.btn('ghost'), padding: '6px 10px', flexShrink: 0 }} onClick={() => setResume(prev => ({ ...prev, achievements: prev.achievements.filter((_, i) => i !== idx) }))}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Preview ─────────────────────────────────────── */}
        <div>
          <div style={S.card}>
            <div style={S.cardHeader}>
              <p style={S.cardTitle}>👁️ Live Preview</p>
              <button style={S.btn('success')} onClick={exportPDF}>🖨️ Export PDF</button>
            </div>
            <div style={{ padding: 16 }}>
              <div ref={previewRef} className="resume-preview" style={S.previewPage}>
                <ResumePreview resume={resume} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Resume Preview (A4-style white page) ─────────────────────────
function ResumePreview({ resume }) {
  const { personal, summary, education, experience, projects, skills, achievements, certifications } = resume;

  const allSkills = [
    ...skills.languages.map(s => s),
    ...skills.frameworks.map(s => s),
    ...skills.tools.map(s => s),
    ...skills.databases.map(s => s),
  ];

  return (
    <div style={{ color: '#1a1a1a', fontFamily: "'Georgia', serif", fontSize: 13, lineHeight: 1.5 }}>
      {/* Name + Contact */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: 12, marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' }}>
          {personal.name || 'Your Name'}
        </h1>
        <div style={{ fontSize: 12, color: '#444', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
          {personal.phone    && <span>📞 {personal.phone}</span>}
          {personal.email    && <span>✉️ {personal.email}</span>}
          {personal.location && <span>📍 {personal.location}</span>}
          {personal.linkedin && <span>🔗 LinkedIn</span>}
          {personal.github   && <span>💻 GitHub</span>}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <Section title="PROFESSIONAL SUMMARY">
          <p style={{ margin: 0, fontStyle: 'italic' }}>{summary}</p>
        </Section>
      )}

      {/* Education */}
      {education.some(e => e.college) && (
        <Section title="EDUCATION">
          {education.filter(e => e.college).map((edu, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{edu.degree}</strong>
                <span style={{ fontSize: 12, color: '#555' }}>{edu.year}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#333' }}>{edu.college}</span>
                {edu.cgpa && <span>CGPA: {edu.cgpa}</span>}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Experience */}
      {experience.some(e => e.role) && (
        <Section title="EXPERIENCE">
          {experience.filter(e => e.role).map((exp, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{exp.role}</strong>
                <span style={{ fontSize: 12, color: '#555' }}>{exp.duration}</span>
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{exp.company}</div>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {(exp.bullets || []).map((b, bi) => b && <li key={bi} style={{ marginBottom: 2 }}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {/* Projects */}
      {projects.some(p => p.name) && (
        <Section title="PROJECTS">
          {projects.filter(p => p.name).map((proj, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{proj.name}</strong>
                <span style={{ fontSize: 11, color: '#555' }}>{proj.tech}</span>
              </div>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {(proj.bullets || []).map((b, bi) => b && <li key={bi} style={{ marginBottom: 2 }}>{b}</li>)}
              </ul>
            </div>
          ))}
        </Section>
      )}

      {/* Skills */}
      {allSkills.length > 0 && (
        <Section title="TECHNICAL SKILLS">
          <div style={{ fontSize: 12 }}>
            {skills.languages.length > 0    && <div><strong>Languages:</strong> {skills.languages.join(', ')}</div>}
            {skills.frameworks.length > 0   && <div><strong>Frameworks:</strong> {skills.frameworks.join(', ')}</div>}
            {skills.tools.length > 0        && <div><strong>Tools:</strong> {skills.tools.join(', ')}</div>}
            {skills.databases.length > 0    && <div><strong>Databases:</strong> {skills.databases.join(', ')}</div>}
          </div>
        </Section>
      )}

      {/* Achievements */}
      {achievements.some(a => a) && (
        <Section title="ACHIEVEMENTS">
          <ul style={{ margin: '0 0 0 16px', padding: 0 }}>
            {achievements.filter(a => a).map((a, i) => <li key={i} style={{ marginBottom: 2 }}>{a}</li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        borderBottom: '1px solid #1a1a1a', paddingBottom: 3, marginBottom: 8,
        textTransform: 'uppercase', fontFamily: "'Arial', sans-serif",
      }}>{title}</div>
      {children}
    </div>
  );
}
