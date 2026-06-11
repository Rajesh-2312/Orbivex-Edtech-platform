/**
 * backend/routes/resume.js
 * AI Resume Builder — generate bullet points, save resumes, export
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { success, error } = require('../utils/response');

// ─── Ollama helper (same pattern as other agents) ─────────────────


function extractJSON(raw) {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[') !== -1 &&
    (cleaned.indexOf('[') < (cleaned.indexOf('{') === -1 ? Infinity : cleaned.indexOf('{')))
    ? cleaned.indexOf('[')
    : cleaned.indexOf('{');
  const isArr = cleaned[start] === '[';
  const end   = isArr ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ─── POST /api/resume/generate-bullets ───────────────────────────
// Body: { role, experience_desc, skills, company_type }
// Returns: { bullets: string[] }  (5-6 strong resume bullets)
router.post('/generate-bullets', authMiddleware, async (req, res) => {
  const { role, experience_desc, skills = [], company_type = 'product' } = req.body;

  if (!role || !experience_desc) {
    return error(res, 'role and experience_desc are required');
  }

  const skillsList = Array.isArray(skills) ? skills.join(', ') : skills;

  const prompt = `You are an expert resume writer for Indian engineering students targeting ${company_type} companies.

Write 5 strong, ATS-optimized resume bullet points for the following:

Role: ${role}
Experience / Project Description: ${experience_desc}
Skills used: ${skillsList || 'Not specified'}

Rules:
- Start each bullet with a strong action verb (Built, Designed, Reduced, Improved, Led, etc.)
- Include metrics/numbers wherever possible (e.g., "reduced latency by 40%", "served 2000+ users")
- Keep each bullet under 120 characters
- Focus on impact, not just tasks
- Use STAR format implicitly (Situation → Task → Action → Result)
- Tailor for ${company_type} company hiring

Return ONLY a JSON array of strings. No explanation, no markdown, just the JSON array.
Example: ["Built REST API...", "Reduced load time by 35%..."]`;

  try {
    const raw     = await aiChat(prompt);
    const bullets = extractJSON(raw);

    if (!Array.isArray(bullets)) {
      throw new Error('Expected JSON array');
    }

    return success(res, { bullets: bullets.slice(0, 6) });
  } catch (err) {
    console.error('[resume/generate-bullets]', err.message);
    return error(res, 'AI bullet generation failed. Try again or check Ollama.', 500);
  }
});

// ─── POST /api/resume/generate-summary ───────────────────────────
// Body: { name, role, skills, cgpa, college }
// Returns: { summary: string }
router.post('/generate-summary', authMiddleware, async (req, res) => {
  const { name, role, skills = [], cgpa, college, year_of_passing } = req.body;
  if (!role) return error(res, 'role is required');

  const skillsList = Array.isArray(skills) ? skills.join(', ') : skills;

  const prompt = `Write a 3-sentence professional summary for an Indian engineering student resume.

Details:
- Name: ${name || 'Student'}
- Seeking: ${role}
- College: ${college || 'Engineering College'}
- CGPA: ${cgpa || 'N/A'}
- Key Skills: ${skillsList}
- Year of passing: ${year_of_passing || '2025'}

Rules:
- Professional, first-person or third-person (be consistent)
- Mention skills and career goal
- Under 80 words total
- No fluff words like "passionate", "hardworking", "team player"

Return ONLY the summary text string. No JSON, no quotes, no explanation.`;

  try {
    const raw     = await aiChat(prompt);
    const summary = raw.replace(/^["']|["']$/g, '').trim();
    return success(res, { summary });
  } catch (err) {
    console.error('[resume/generate-summary]', err.message);
    return error(res, 'Summary generation failed.', 500);
  }
});

// ─── POST /api/resume/save ───────────────────────────────────────
// Body: { resume_json }  — full resume data object
router.post('/save', authMiddleware, async (req, res) => {
  const { resume_json, title } = req.body;
  if (!resume_json) return error(res, 'resume_json is required');

  const { data, error: dbErr } = await supabaseAdmin
    .from('resumes')
    .upsert({
      student_id  : req.user.id,
      title       : title || 'My Resume',
      resume_json,
      updated_at  : new Date().toISOString(),
    }, { onConflict: 'student_id' })
    .select()
    .single();

  if (dbErr) return error(res, dbErr.message);
  return success(res, { resume: data });
});

// ─── GET /api/resume ─────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { data, error: dbErr } = await supabaseAdmin
    .from('resumes')
    .select('*')
    .eq('student_id', req.user.id)
    .single();

  if (dbErr && dbErr.code !== 'PGRST116') return error(res, dbErr.message);
  return success(res, { resume: data || null });
});

module.exports = router;
