/**
 * LSRW Skills Routes — Listening, Speaking, Reading, Writing
 * Replaces the external FastAPI microservice.
 * All content is served from embedded seed data; sessions + scores are stored in Supabase.
 * AI evaluation is done via NVIDIA NIM (same as every other agent).
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { generateCompletion, generateCompletionDetailed } = require('../config/ai');
const { success, error } = require('../utils/response');

// ─── Seed Content ─────────────────────────────────────────────────────────────

const LISTENING_PASSAGES = [
  {
    id: 'l1', level: 'beginner', duration_seconds: 45,
    title: 'The Water Cycle',
    text: 'The water cycle is the continuous movement of water through the Earth\'s systems. Water evaporates from oceans and lakes, rises as water vapour, cools to form clouds, and falls back as rain or snow. This process is essential for distributing fresh water across the planet. Plants also release water through transpiration, contributing to the cycle.',
    questions: ['What causes water to rise into the atmosphere?', 'Name two ways water returns to the Earth\'s surface.', 'How do plants contribute to the water cycle?'],
  },
  {
    id: 'l2', level: 'intermediate', duration_seconds: 60,
    title: 'Artificial Intelligence in Healthcare',
    text: 'Artificial intelligence is rapidly transforming healthcare. Machine learning algorithms can now detect cancers from medical images with accuracy comparable to experienced radiologists. AI-powered chatbots help patients with preliminary diagnoses and appointment scheduling. However, ethical concerns remain about data privacy, algorithmic bias, and the replacement of human medical judgment. Regulators worldwide are working to establish frameworks that balance innovation with patient safety.',
    questions: ['How does AI compare to radiologists in detecting cancer?', 'What are two applications of AI in healthcare mentioned?', 'What are the main ethical concerns with medical AI?'],
  },
  {
    id: 'l3', level: 'advanced', duration_seconds: 75,
    title: 'Quantum Computing and Cryptography',
    text: 'Quantum computers exploit the principles of superposition and entanglement to perform computations exponentially faster than classical machines. This poses a significant threat to current cryptographic systems like RSA, which rely on the difficulty of factoring large numbers — a task quantum computers could accomplish in minutes. Governments and corporations are investing in post-quantum cryptography standards. The National Institute of Standards and Technology finalised its first set of post-quantum algorithms in 2024, marking a critical step toward securing global digital infrastructure.',
    questions: ['What quantum principles enable faster computation?', 'Why is RSA encryption vulnerable to quantum computers?', 'What milestone did NIST achieve in 2024?'],
  },
];

const SPEAKING_TOPICS = [
  {
    id: 's1', level: 'beginner', duration_seconds: 60,
    title: 'Your Favourite Subject',
    prompt: 'Talk about your favourite subject in school or college. Why do you enjoy it? Give an example of something interesting you learned.',
    key_phrases: ['I enjoy', 'For example', 'This helps me'],
  },
  {
    id: 's2', level: 'intermediate', duration_seconds: 90,
    title: 'Technology and Society',
    prompt: 'Discuss how technology has changed everyday life in India over the past decade. Mention both benefits and drawbacks.',
    key_phrases: ['On one hand', 'However', 'For instance', 'In conclusion'],
  },
  {
    id: 's3', level: 'advanced', duration_seconds: 120,
    title: 'Climate Change Solutions',
    prompt: 'Present an argument for which sector — energy, transport, or agriculture — should receive the highest priority in India\'s climate action plan, and why.',
    key_phrases: ['Evidence suggests', 'Comparatively', 'The most effective approach', 'In summary'],
  },
];

const READING_PASSAGES = [
  {
    id: 'r1', level: 'beginner', read_time_minutes: 3,
    title: 'The Benefits of Exercise',
    passage: 'Regular physical exercise offers numerous benefits for both the body and mind. Aerobic activities such as running, swimming, and cycling improve cardiovascular health, helping the heart pump blood more efficiently. Strength training builds muscle mass and supports bone density, reducing the risk of osteoporosis. Beyond physical health, exercise releases endorphins — chemicals that improve mood and reduce stress. Even 30 minutes of moderate exercise five days a week can significantly lower the risk of chronic diseases such as diabetes and hypertension. For students, regular exercise has been linked to improved concentration and academic performance.',
    questions: [
      { id: 'r1q0', question_type: 'comprehension', question: 'Which type of exercise improves cardiovascular health?', opts: ['Strength training', 'Aerobic exercise', 'Yoga', 'Stretching'], answer: 'B' },
      { id: 'r1q1', question_type: 'comprehension', question: 'What chemical released by exercise improves mood?', opts: ['Serotonin', 'Dopamine', 'Endorphins', 'Cortisol'], answer: 'C' },
      { id: 'r1q2', question_type: 'inference', question: 'How does exercise benefit students specifically?', opts: ['Reduces sleep needs', 'Improves concentration and grades', 'Increases appetite', 'Reduces screen time'], answer: 'B' },
    ],
  },
  {
    id: 'r2', level: 'intermediate', read_time_minutes: 5,
    title: 'India\'s Space Programme',
    passage: 'India\'s space programme, managed by the Indian Space Research Organisation (ISRO), has grown from a modest beginning in 1969 into a globally respected agency. The Chandrayaan-3 mission in 2023 made India the first country to land near the lunar south pole, a region of great scientific interest due to the presence of water ice. ISRO\'s cost-effective approach — the Mars Orbiter Mission cost less than the Hollywood film Gravity — has attracted international attention and commercial launch contracts. The agency\'s PSLV rocket has launched satellites for over 30 countries. India is now developing the Gaganyaan crewed spacecraft, aiming to send Indian astronauts to orbit by 2025.',
    questions: [
      { id: 'r2q0', question_type: 'comprehension', question: 'When was ISRO founded?', opts: ['1947', '1969', '1980', '1990'], answer: 'B' },
      { id: 'r2q1', question_type: 'comprehension', question: 'What was unique about Chandrayaan-3\'s landing?', opts: ['First Indian moon mission', 'First ever moon landing', 'First landing near lunar south pole', 'First robotic rover'], answer: 'C' },
      { id: 'r2q2', question_type: 'comprehension', question: 'What is Gaganyaan?', opts: ['A Mars probe', 'A communication satellite', 'A crewed spacecraft', 'A launch vehicle'], answer: 'C' },
    ],
  },
  {
    id: 'r3', level: 'advanced', read_time_minutes: 7,
    title: 'The Economics of Automation',
    passage: 'The widespread adoption of automation and artificial intelligence is reshaping labour markets in ways that economists are still debating. Classical economic theory holds that technological displacement is temporary: new industries emerge to absorb displaced workers, as happened during the Industrial Revolution. However, several economists argue that AI-driven automation is qualitatively different because it can substitute for cognitive as well as manual labour. Studies suggest that up to 47% of US occupations face a high risk of automation within two decades. India, with its large services sector and demographic dividend, faces a dual challenge: leveraging automation for productivity gains while managing potential job displacement among a workforce of over 500 million. Policy responses under discussion include universal basic income, reskilling subsidies, and adjustments to capital taxation.',
    questions: [
      { id: 'r3q0', question_type: 'comprehension', question: 'What does classical economic theory say about technological displacement?', opts: ['It is permanent', 'New industries will absorb workers', 'Wages will fall permanently', 'Government must intervene always'], answer: 'B' },
      { id: 'r3q1', question_type: 'inference', question: 'Why do some economists see AI as different from past automation?', opts: ['It is faster', 'It can replace cognitive labour too', 'It is cheaper', 'It was not predicted'], answer: 'B' },
      { id: 'r3q2', question_type: 'comprehension', question: 'What percentage of US occupations may face automation risk?', opts: ['20%', '35%', '47%', '60%'], answer: 'C' },
    ],
  },
];

const WRITING_PROMPTS = [
  {
    id: 'w1', level: 'beginner', time_limit_minutes: 10, target_word_count: 150,
    title: 'My College Experience',
    prompt: 'Write about your experience in college so far. What do you enjoy most? What challenges have you faced? What are your goals for the future?',
  },
  {
    id: 'w2', level: 'intermediate', time_limit_minutes: 20, target_word_count: 250,
    title: 'Social Media: Blessing or Curse?',
    prompt: 'Discuss whether social media has had a net positive or negative impact on society. Support your argument with specific examples.',
  },
  {
    id: 'w3', level: 'advanced', time_limit_minutes: 30, target_word_count: 350,
    title: 'India\'s Path to Sustainable Development',
    prompt: 'Critically examine the tension between India\'s economic development goals and its commitments to environmental sustainability. Propose a policy approach that addresses both.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function saveSession(student_id, skill_type, content_id) {
  const sessionId = crypto.randomUUID();
  try {
    const { error: dbErr } = await supabaseAdmin.from('lsrw_sessions').insert({
      id: sessionId, student_id, skill_type, content_id, status: 'started',
    });
    if (dbErr) console.warn('[lsrw] saveSession warning:', dbErr.message);
  } catch (e) {
    console.warn('[lsrw] saveSession error (table may not exist):', e?.message);
  }
  return sessionId; // always return the UUID regardless of DB outcome
}

async function saveEvaluation(student_id, skill_type, score, session_id, metadata = {}) {
  try {
    const { error: dbErr } = await supabaseAdmin.from('lsrw_evaluations').insert({
      student_id, skill_type, score, session_id, metadata,
    });
    if (dbErr) console.warn('[lsrw] saveEvaluation warning:', dbErr.message);
  } catch (e) {
    console.warn('[lsrw] saveEvaluation error:', e?.message);
  }
}

// Provider label shown to students on the result page ("Evaluated by …").
const PROVIDER_LABEL = { nvidia: 'NVIDIA NIM', openrouter: 'OpenRouter' };

async function aiEvaluate(prompt) {
  const { text, provider, model } = await generateCompletionDetailed('advanced', prompt, {
    temperature: 0.2,
    max_tokens: 800,
    cache: false,
  });
  // Report the provider that actually answered — failover means it is not
  // always the configured primary.
  const meta = { model_used: model, provider_used: PROVIDER_LABEL[provider] || provider };
  const parsed = parseJsonObject(text);
  if (parsed) return { ...parsed, ...meta };
  // Unparseable — surface the prose rather than inventing sub-scores.
  return { score: 60, feedback: text.slice(0, 600), strengths: [], improvements: [], ...meta };
}

/**
 * Normalise the AI's `corrections` into the {original, suggestion, reason}
 * shape the result page renders. Models drift between field names and
 * sometimes return plain strings; anything we cannot map to a before/after
 * pair is dropped, because a half-empty correction renders as blank pills.
 */
function normaliseCorrections(list) {
  if (!Array.isArray(list)) return [];
  return list.map((c) => {
    if (!c || typeof c !== 'object') return null;
    const original   = String(c.original ?? c.before ?? c.error ?? c.incorrect ?? '').trim();
    const suggestion = String(c.suggestion ?? c.corrected ?? c.after ?? c.correction ?? c.correct ?? '').trim();
    const reason     = String(c.reason ?? c.explanation ?? c.why ?? '').trim();
    if (!original || !suggestion) return null;
    return { original, suggestion, reason };
  }).filter(Boolean).slice(0, 8);
}

// ─── AI Content Pools (30 AI-generated items per level, cached) ─────────────────
//
// Generic engine shared by Listening (passages + questions) and Speaking (topics
// + prompts). For each level it generates POOL_SIZE unique items with the fast
// "standard" (8B) model in parallel waves — many small batches beat one slow 70B
// call that would exceed the provider timeout — then caches them in memory and,
// best-effort, in Supabase.

const POOL_LEVELS = ['beginner', 'intermediate', 'advanced'];
const POOL_SIZE = 30;

/**
 * Pull a JSON array out of raw model output.
 *
 * Models routinely emit JSON that JSON.parse rejects: markdown fences, a
 * trailing comma before the closing bracket, or an array cut off mid-element
 * when the response hits max_tokens. Each failure previously discarded a whole
 * batch, so we degrade instead: strict parse → trailing commas stripped →
 * salvage whatever complete {...} objects are present (which also rescues
 * truncated arrays).
 */
function parseJsonArray(raw) {
  const fenced = String(raw || '').replace(/```(?:json)?/gi, '');
  const start = fenced.indexOf('[');
  if (start === -1) return [];
  const text = fenced.slice(start);

  for (const candidate of [text, text.replace(/,(\s*[\]}])/g, '$1')]) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* try the next repair */ }
  }
  return salvageObjects(text);
}

/**
 * Same repair chain as parseJsonArray, for responses that are a single JSON
 * object (the evaluators). Returns null when nothing usable is present.
 */
function parseJsonObject(raw) {
  const fenced = String(raw || '').replace(/```(?:json)?/gi, '');
  const start = fenced.indexOf('{');
  if (start === -1) return null;
  const text = fenced.slice(start);

  for (const candidate of [text, text.replace(/,(\s*[\]}])/g, '$1')]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* try the next repair */ }
  }
  // Trailing prose after the object, or a truncated tail — take the first complete one.
  return salvageObjects(text)[0] || null;
}

/** Extract each complete top-level {...} object, ignoring braces inside strings. */
function salvageObjects(text) {
  const out = [];
  let depth = 0, start = -1, inString = false, escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        try { out.push(JSON.parse(text.slice(start, i + 1))); } catch { /* skip malformed element */ }
        start = -1;
      }
    }
  }
  return out;
}

/**
 * @param decorateItem — per-skill timing/metadata merged onto every item
 *                       (Listening/Speaking use duration_seconds, Reading
 *                       read_time_minutes, Writing time_limit_minutes).
 * @param batchSize    — items per request; lower it for verbose skills so the
 *                       array does not get truncated by max_tokens.
 */
function createPool({
  skill, table, meta, batchPrompt, normalise, itemFields, seedFor,
  decorateItem = (m) => ({ duration_seconds: m.duration_seconds }),
  batchSize = 6,
  maxTokens = 2000,
}) {
  const cache = new Map(); // level -> decorated items

  const decorate = (level, list) => list.map((it, i) => ({
    id: `${level}-${i + 1}`, level, ...decorateItem(meta[level] || meta.beginner), ...it,
  }));
  const strip = (it) => Object.fromEntries(itemFields.map(f => [f, it[f]]));

  async function batch(level, count) {
    try {
      // Pool batches are long generations (multi-thousand token JSON). OpenRouter
      // reliably times out on those while NVIDIA's 8B completes them in ~40s, so
      // pools prefer NVIDIA — the opposite of the interactive default. Failover
      // still applies; this only reorders the attempts.
      const raw = await generateCompletion('standard', batchPrompt(level, count, meta[level] || meta.beginner),
        { temperature: 0.8, max_tokens: maxTokens, cache: false, providerOrder: ['nvidia', 'openrouter'] });
      return normalise(parseJsonArray(raw));
    } catch (e) {
      console.warn(`[lsrw] ${skill} batch (${level}) failed:`, e?.message);
      return [];
    }
  }

  async function generate(level) {
    // Eight parallel batches of six per wave (matches the AI concurrency cap) so
    // one wave usually suffices; at most two waves, bounded by a ~35s budget.
    const seen = new Set();
    const items = [];
    const collect = (b) => { for (const it of b) { const k = it.title.toLowerCase(); if (!seen.has(k)) { seen.add(k); items.push(it); } } };
    const started = Date.now();
    const perWave = Math.ceil(POOL_SIZE / batchSize) + 2; // enough batches to fill the pool, plus slack for rejects
    for (let wave = 0; wave < 2 && items.length < POOL_SIZE && Date.now() - started < 35000; wave++) {
      const results = await Promise.allSettled(
        Array.from({ length: perWave }, () => batch(level, batchSize))
      );
      for (const r of results) if (r.status === 'fulfilled') collect(r.value);
    }
    return items;
  }

  async function get(level) {
    if (cache.has(level)) return cache.get(level);

    // 1) Persistent Supabase cache (best-effort — table may not exist yet).
    try {
      const { data } = await supabaseAdmin.from(table).select('items').eq('level', level).maybeSingle();
      if (data?.items?.length >= POOL_SIZE) {
        const pool = decorate(level, data.items.slice(0, POOL_SIZE));
        cache.set(level, pool);
        return pool;
      }
    } catch { /* table missing — fall through to generation */ }

    // 2) Generate via AI.
    const items = await generate(level);

    // 3) Top up to POOL_SIZE if the model returned fewer — prefer cycling through
    //    the real generated items (varied); only fall back to seed content if the
    //    model produced nothing at all.
    if (items.length < POOL_SIZE) {
      const seed = seedFor(level);
      const source = items.length ? items.slice() : (seed.length ? seed : [{ title: `${skill} Practice` }]);
      let n = 0;
      while (items.length < POOL_SIZE) {
        const base = source[n % source.length];
        items.push({ ...base, title: `${base.title} (practice ${items.length + 1})` });
        n++;
      }
    }

    const pool = decorate(level, items.slice(0, POOL_SIZE));
    cache.set(level, pool);

    // 4) Persist for next time (best-effort).
    try {
      await supabaseAdmin.from(table).upsert({ level, items: pool.map(strip) }, { onConflict: 'level' });
    } catch { /* table missing — in-memory cache still serves this process */ }

    return pool;
  }

  return { get };
}

// ── Listening pool ──
const LISTENING_POOL = createPool({
  skill: 'listening',
  table: 'lsrw_listening_pool',
  itemFields: ['title', 'text', 'questions'],
  meta: {
    beginner:     { duration_seconds: 45, guide: 'everyday, concrete topics (nature, daily life, simple science, sports, food, festivals). Simple vocabulary and short sentences. 50-70 words each.' },
    intermediate: { duration_seconds: 60, guide: 'general-knowledge topics (technology, society, history, environment, health, culture). Moderate vocabulary. 80-110 words each.' },
    advanced:     { duration_seconds: 75, guide: 'abstract or technical topics (economics, science, philosophy, geopolitics, advanced technology). Rich vocabulary and complex ideas. 90-120 words each.' },
  },
  batchPrompt: (level, count, m) => `Generate ${count} DISTINCT English listening-comprehension passages for ${level.toUpperCase()} learners.
Topics: ${m.guide}
Each passage must be self-contained, factually plausible, and cover a different topic.
Return ONLY a valid JSON array (no markdown, no prose). Each element must be exactly:
{"title":"<short title>","text":"<the passage>","questions":["<question 1>","<question 2>","<question 3>"]}
Return exactly ${count} elements.`,
  normalise: (arr) => (Array.isArray(arr) ? arr : [])
    .filter(p => p && typeof p.text === 'string' && p.text.trim().length > 30 && Array.isArray(p.questions) && p.questions.length >= 2)
    .map(p => ({ title: String(p.title || 'Listening Passage').slice(0, 120), text: String(p.text).trim(), questions: p.questions.slice(0, 3).map(q => String(q)) })),
  seedFor: (level) => LISTENING_PASSAGES.filter(p => p.level === level).map(p => ({ title: p.title, text: p.text, questions: p.questions })),
});

// ── Speaking pool ──
const SPEAKING_POOL = createPool({
  skill: 'speaking',
  table: 'lsrw_speaking_pool',
  itemFields: ['title', 'prompt', 'key_phrases'],
  meta: {
    beginner:     { duration_seconds: 60,  guide: 'everyday, personal topics (hobbies, family, food, daily routine, favourite place). Simple and easy to talk about.' },
    intermediate: { duration_seconds: 90,  guide: 'opinion and general-knowledge topics (technology, education, environment, social media, travel). Require some reasoning.' },
    advanced:     { duration_seconds: 120, guide: 'abstract, argumentative or analytical topics (ethics, economics, policy, science, society). Require structured argument.' },
  },
  batchPrompt: (level, count, m) => `Generate ${count} DISTINCT English speaking-practice topics for ${level.toUpperCase()} learners.
Style: ${m.guide}
Each topic must invite the learner to speak for about ${m.duration_seconds} seconds and cover a different subject.
Return ONLY a valid JSON array (no markdown, no prose). Each element must be exactly:
{"title":"<short title>","prompt":"<the speaking prompt, 1-2 sentences>","key_phrases":["<phrase 1>","<phrase 2>","<phrase 3>"]}
Return exactly ${count} elements.`,
  normalise: (arr) => (Array.isArray(arr) ? arr : [])
    .filter(t => t && typeof t.prompt === 'string' && t.prompt.trim().length > 15)
    .map(t => ({
      title: String(t.title || 'Speaking Topic').slice(0, 120),
      prompt: String(t.prompt).trim(),
      key_phrases: Array.isArray(t.key_phrases) ? t.key_phrases.slice(0, 4).map(p => String(p)) : [],
    })),
  seedFor: (level) => SPEAKING_TOPICS.filter(t => t.level === level).map(t => ({ title: t.title, prompt: t.prompt, key_phrases: t.key_phrases })),
});

// ── Reading pool ──
// Each item carries its own MCQs and answer key, so batches are the most
// token-heavy of the four skills — hence the smaller batchSize.
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const READING_POOL = createPool({
  skill: 'reading',
  table: 'lsrw_reading_pool',
  itemFields: ['title', 'passage', 'questions'],
  decorateItem: (m) => ({ read_time_minutes: m.read_time_minutes }),
  batchSize: 3,
  maxTokens: 3500,
  meta: {
    beginner:     { read_time_minutes: 3, guide: 'everyday, concrete topics (health, nature, daily life, sports, food, festivals). Simple vocabulary and short sentences. 90-130 words.' },
    intermediate: { read_time_minutes: 5, guide: 'general-knowledge topics (technology, society, history, environment, science, culture). Moderate vocabulary. 140-200 words.' },
    advanced:     { read_time_minutes: 7, guide: 'abstract or technical topics (economics, philosophy, geopolitics, advanced science, policy). Rich vocabulary and complex argument. 200-260 words.' },
  },
  batchPrompt: (level, count, m) => `Generate ${count} DISTINCT English reading-comprehension passages for ${level.toUpperCase()} learners.
Topics: ${m.guide}
Each passage must be self-contained, factually accurate, and cover a different topic.
Write exactly 3 multiple-choice questions per passage, each with exactly 4 options.
"answer" must be the LETTER (A, B, C or D) of the correct option, and that option must be genuinely correct per the passage.
Mix question_type between "comprehension" (stated directly) and "inference" (requires reasoning).
Return ONLY a valid JSON array (no markdown, no prose, no trailing commas). Each element must be exactly:
{"title":"<short title>","passage":"<the passage>","questions":[{"question_type":"comprehension","question":"<question>","opts":["<A>","<B>","<C>","<D>"],"answer":"B"}]}
Return exactly ${count} elements.`,
  normalise: (arr) => (Array.isArray(arr) ? arr : [])
    .filter(p => p && typeof p.passage === 'string' && p.passage.trim().length > 60 && Array.isArray(p.questions) && p.questions.length >= 2)
    .map(p => ({
      title: String(p.title || 'Reading Passage').slice(0, 120),
      passage: String(p.passage).trim(),
      questions: p.questions
        // Drop questions whose answer key is unusable — a wrong key is worse than one fewer question.
        .filter(q => q && typeof q.question === 'string' && Array.isArray(q.opts) && q.opts.length === 4
          && OPTION_LABELS.includes(String(q.answer || '').trim().toUpperCase()))
        .slice(0, 3)
        .map((q, i) => ({
          id: `q${i}`,
          question_type: q.question_type === 'inference' ? 'inference' : 'comprehension',
          question: String(q.question).trim(),
          opts: q.opts.map(o => String(o)),
          answer: String(q.answer).trim().toUpperCase(),
        })),
    }))
    .filter(p => p.questions.length >= 2),
  seedFor: (level) => READING_PASSAGES.filter(p => p.level === level).map(p => ({ title: p.title, passage: p.passage, questions: p.questions })),
});

// ── Writing pool ──
const WRITING_POOL = createPool({
  skill: 'writing',
  table: 'lsrw_writing_pool',
  itemFields: ['title', 'prompt'],
  decorateItem: (m) => ({ time_limit_minutes: m.time_limit_minutes, target_word_count: m.target_word_count }),
  batchSize: 8,
  meta: {
    beginner:     { time_limit_minutes: 10, target_word_count: 150, guide: 'personal, descriptive topics (college life, hometown, hobbies, a memorable day, family). Easy to write from experience.' },
    intermediate: { time_limit_minutes: 20, target_word_count: 250, guide: 'opinion and discussion topics (technology, education, environment, social media, work culture). Require a clear argument with examples.' },
    advanced:     { time_limit_minutes: 30, target_word_count: 400, guide: 'analytical or argumentative topics (ethics, economics, policy, science and society). Require a structured, evidence-based argument.' },
  },
  batchPrompt: (level, count, m) => `Generate ${count} DISTINCT English writing-practice prompts for ${level.toUpperCase()} learners.
Style: ${m.guide}
Each prompt must be answerable in about ${m.target_word_count} words within ${m.time_limit_minutes} minutes, and cover a different subject.
Return ONLY a valid JSON array (no markdown, no prose, no trailing commas). Each element must be exactly:
{"title":"<short title>","prompt":"<the writing task, 1-3 sentences, stating clearly what to write>"}
Return exactly ${count} elements.`,
  normalise: (arr) => (Array.isArray(arr) ? arr : [])
    .filter(w => w && typeof w.prompt === 'string' && w.prompt.trim().length > 20)
    .map(w => ({
      title: String(w.title || 'Writing Prompt').slice(0, 120),
      prompt: String(w.prompt).trim(),
    })),
  seedFor: (level) => WRITING_PROMPTS.filter(w => w.level === level).map(w => ({ title: w.title, prompt: w.prompt })),
});

// ─── Proctoring ───────────────────────────────────────────────────────────────

// Reasons the client may report. Whitelisted so a tampered client cannot write
// arbitrary strings into what is meant to be reviewable evidence.
const PROCTOR_REASONS = new Set([
  'camera_covered', 'camera_frozen', 'camera_lost', 'looking_away',
  'no_face', 'multiple_faces', 'phone_detected',
  'tab_switch', 'window_blur', 'fullscreen_exit',
]);

// End an attempt because a proctoring rule was broken.
// The student's answers are never submitted — termination discards the attempt.
router.post('/session/:id/terminate', authMiddleware, async (req, res) => {
  const reason = PROCTOR_REASONS.has(req.body?.reason) ? req.body.reason : 'unknown';
  try {
    // Scoped to the caller: a student must not be able to terminate someone
    // else's attempt by guessing a session UUID.
    const { error: dbErr } = await supabaseAdmin
      .from('lsrw_sessions')
      .update({ status: 'terminated', terminated_at: new Date().toISOString(), termination_reason: reason })
      .eq('id', req.params.id)
      .eq('student_id', req.user.id);
    if (dbErr) console.warn('[lsrw] terminate warning:', dbErr.message);
  } catch (e) {
    console.warn('[lsrw] terminate error:', e?.message);
  }
  // Always acknowledge. The browser has already ended the attempt locally; a DB
  // problem here must not leave the student staring at a hung screen.
  res.json({ terminated: true, reason });
});

// Append the violation audit trail (warnings + the final termination).
router.post('/session/:id/proctor-events', authMiddleware, async (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 50) : [];
  const rows = events
    .filter(e => PROCTOR_REASONS.has(e?.reason) && ['warn', 'terminate'].includes(e?.severity))
    .map(e => ({
      session_id: req.params.id,
      student_id: req.user.id,
      reason: e.reason,
      severity: e.severity,
      details: { at: e.at || null },
    }));

  if (rows.length) {
    try {
      const { error: dbErr } = await supabaseAdmin.from('lsrw_proctor_events').insert(rows);
      if (dbErr) console.warn('[lsrw] proctor-events warning:', dbErr.message);
    } catch (e) {
      console.warn('[lsrw] proctor-events error (table may not exist):', e?.message);
    }
  }
  res.json({ logged: rows.length });
});

// ─── Content Endpoints ────────────────────────────────────────────────────────

router.get('/content/all', authMiddleware, (req, res) => {
  res.json({ passages: LISTENING_PASSAGES, topics: SPEAKING_TOPICS, reading: READING_PASSAGES, prompts: WRITING_PROMPTS });
});

// ─── Listening ────────────────────────────────────────────────────────────────

router.get('/listening/passages', authMiddleware, (req, res) => {
  res.json({ passages: LISTENING_PASSAGES });
});

// 30 AI-generated audios for a level (beginner | intermediate | advanced), cached.
router.get('/listening/pool/:level', authMiddleware, async (req, res) => {
  const level = POOL_LEVELS.includes(req.params.level) ? req.params.level : 'beginner';
  try {
    const passages = await LISTENING_POOL.get(level);
    res.json({ level, passages });
  } catch (e) {
    console.error('[lsrw] listening pool:', e?.message);
    // Last resort: seed passages for that level so the page still renders.
    res.json({ level, passages: LISTENING_PASSAGES.filter(p => p.level === level) });
  }
});

router.post('/listening/start-session', authMiddleware, async (req, res) => {
  try {
    const { student_id, content_id } = req.query;
    const sessionId = await saveSession(student_id || req.user.id, 'listening', content_id);
    res.json({ session_id: sessionId });
  } catch (e) {
    res.json({ session_id: crypto.randomUUID() }); // always succeed
  }
});

router.post('/listening/evaluate', authMiddleware, async (req, res) => {
  try {
    const { passage_text, questions, student_answers, student_id, session_id } = req.body;
    if (!passage_text || !questions?.length || !student_answers?.length) {
      return error(res, 'passage_text, questions, and student_answers are required');
    }

    const qa = questions.map((q, i) => `Q: ${q}\nA: ${student_answers[i] || '(no answer)'}`).join('\n\n');

    const prompt = `You are an English listening comprehension evaluator.

PASSAGE:
${passage_text}

STUDENT ANSWERS:
${qa}

Evaluate the student's comprehension. Return ONLY valid JSON:
{
  "score": <0-100>,
  "feedback": "<2-3 sentence overall feedback>",
  "question_results": [{"question": "<q>", "student_answer": "<student answer>", "score": <0-100>, "explanation": "<brief comment>"}],
  "strengths": ["<point>"],
  "improvements": ["<point>"]
}`;

    const result = await aiEvaluate(prompt);
    // Normalise legacy per_question → question_results
    if (!result.question_results && result.per_question) {
      result.question_results = result.per_question.map(q => ({
        question: q.question,
        student_answer: q.answer,
        score: q.correct ? 100 : 0,
        explanation: q.comment || (q.correct ? 'Correct.' : 'Needs improvement.'),
      }));
    }
    await saveEvaluation(student_id || req.user.id, 'listening', result.score || 60, session_id, { questions, student_answers });
    res.json(result);
  } catch (err) {
    console.error('[lsrw] listening evaluate:', err.message);
    return error(res, 'Evaluation failed. Please try again.', 500);
  }
});

// ─── Speaking ─────────────────────────────────────────────────────────────────

router.get('/speaking/topics', authMiddleware, (req, res) => {
  res.json({ topics: SPEAKING_TOPICS });
});

// 30 AI-generated speaking topics for a level (beginner | intermediate | advanced), cached.
router.get('/speaking/pool/:level', authMiddleware, async (req, res) => {
  const level = POOL_LEVELS.includes(req.params.level) ? req.params.level : 'beginner';
  try {
    const topics = await SPEAKING_POOL.get(level);
    res.json({ level, topics });
  } catch (e) {
    console.error('[lsrw] speaking pool:', e?.message);
    res.json({ level, topics: SPEAKING_TOPICS.filter(t => t.level === level) });
  }
});

router.post('/speaking/start-session', authMiddleware, async (req, res) => {
  try {
    const { student_id, content_id } = req.query;
    const sessionId = await saveSession(student_id || req.user.id, 'speaking', content_id);
    res.json({ session_id: sessionId });
  } catch (e) {
    res.json({ session_id: crypto.randomUUID() });
  }
});

router.post('/speaking/evaluate', authMiddleware, async (req, res) => {
  try {
    const { topic_prompt, transcript, duration_seconds, student_id, session_id } = req.body;

    const transcriptNote = transcript?.trim()
      ? `STUDENT TRANSCRIPT (${duration_seconds || '?'}s):\n${transcript}`
      : `NOTE: Audio was recorded for ${duration_seconds || '?'} seconds but transcription is not available in local mode. Evaluate based on duration and effort.`;

    const prompt = `You are an English speaking evaluator for Indian engineering students.

TOPIC: ${topic_prompt}
${transcriptNote}

Evaluate pronunciation, fluency, grammar, vocabulary, and content relevance.
Return ONLY valid JSON:
{
  "score": <0-100>,
  "feedback": "<2-3 sentence overall feedback>",
  "sub_scores": {
    "pronunciation": <0-100>,
    "fluency": <0-100>,
    "grammar": <0-100>,
    "vocabulary": <0-100>,
    "content_relevance": <0-100>
  },
  "strengths": ["<point>"],
  "improvements": ["<point>"]
}`;

    const result = await aiEvaluate(prompt);
    // Flatten sub_scores onto result for compatibility if AI returned flat fields
    if (!result.sub_scores && (result.pronunciation || result.fluency)) {
      result.sub_scores = {
        pronunciation: result.pronunciation,
        fluency: result.fluency,
        grammar: result.grammar,
        vocabulary: result.vocabulary,
        content_relevance: result.content_relevance,
      };
    }
    result.transcript = transcript || null;
    result.words_per_minute = transcript ? Math.round((transcript.split(/\s+/).length / (duration_seconds || 60)) * 60) : null;
    await saveEvaluation(student_id || req.user.id, 'speaking', result.score || 60, session_id, { topic_prompt, transcript });
    res.json(result);
  } catch (err) {
    console.error('[lsrw] speaking evaluate:', err.message);
    return error(res, 'Evaluation failed. Please try again.', 500);
  }
});

// ─── Reading ──────────────────────────────────────────────────────────────────

router.get('/reading/passages', authMiddleware, (req, res) => {
  res.json({ passages: READING_PASSAGES });
});

// 30 AI-generated passages for a level (beginner | intermediate | advanced), cached.
router.get('/reading/pool/:level', authMiddleware, async (req, res) => {
  const level = POOL_LEVELS.includes(req.params.level) ? req.params.level : 'beginner';
  try {
    const passages = await READING_POOL.get(level);
    res.json({ level, passages });
  } catch (e) {
    console.error('[lsrw] reading pool:', e?.message);
    // Last resort: seed passages for that level so the page still renders.
    res.json({ level, passages: READING_PASSAGES.filter(p => p.level === level) });
  }
});

/**
 * Resolve a passage id to the passage (with its answer key) server-side.
 * Answers are never taken from the request body — the client only sends the id.
 */
async function resolveReadingPassage(passageId) {
  const seed = READING_PASSAGES.find(p => p.id === passageId);
  if (seed) return seed;

  const match = /^(beginner|intermediate|advanced)-\d+$/.exec(String(passageId || ''));
  if (!match) return null;
  const pool = await READING_POOL.get(match[1]);
  return pool.find(p => p.id === passageId) || null;
}

router.post('/reading/start-session', authMiddleware, async (req, res) => {
  try {
    const { student_id, content_id } = req.query;
    const sessionId = await saveSession(student_id || req.user.id, 'reading', content_id);
    res.json({ session_id: sessionId });
  } catch (e) {
    res.json({ session_id: crypto.randomUUID() });
  }
});

router.post('/reading/evaluate', authMiddleware, async (req, res) => {
  try {
    const { passage_id, student_answers, time_taken_seconds, student_id, session_id } = req.body;
    const passage = await resolveReadingPassage(passage_id);
    if (!passage) return error(res, 'Unknown passage_id');

    // Normalise answers: accept array (indexed by position) or object (keyed by question id)
    const getAnswer = (q, i) => {
      if (Array.isArray(student_answers)) return student_answers[i] || '';
      return student_answers?.[q.id] || student_answers?.[i] || '';
    };

    // Score MCQs directly — no AI needed for objective answers
    const question_results = passage.questions.map((q, i) => {
      const studentAns = getAnswer(q, i);
      const correct = q.answer === studentAns;
      const optLabels = ['A', 'B', 'C', 'D'];
      const studentLabel = optLabels.includes(studentAns) ? `${studentAns}: ${q.opts[optLabels.indexOf(studentAns)] || studentAns}` : studentAns || '(no answer)';
      const correctLabel = `${q.answer}: ${q.opts[optLabels.indexOf(q.answer)] || q.answer}`;
      return {
        question: q.question,
        student_answer: studentLabel,
        correct_answer: correctLabel,
        score: correct ? 100 : 0,
        explanation: correct ? 'Correct!' : `The correct answer is ${correctLabel}.`,
      };
    });

    const correctCount = question_results.filter(q => q.score === 100).length;
    const score = Math.round((correctCount / question_results.length) * 100);

    // AI writes qualitative feedback
    const qaStr = question_results.map(q => `Q: ${q.question}\nStudent: ${q.student_answer} | Correct: ${q.correct_answer} (${q.score === 100 ? '✓' : '✗'})`).join('\n\n');
    const prompt = `A student answered reading comprehension questions about "${passage.title}".
${qaStr}
Time taken: ${time_taken_seconds || '?'} seconds.
Write 2 sentences of constructive feedback on their reading comprehension. Be specific. No JSON needed.`;

    let feedback = 'Good effort! Review the passage carefully for the questions you missed.';
    try {
      const raw = await generateCompletion('standard', prompt, { temperature: 0.3, max_tokens: 150, cache: false });
      if (raw?.trim()) feedback = raw.trim();
    } catch {}

    const result = { score, feedback, question_results, correct: correctCount, total: question_results.length };
    await saveEvaluation(student_id || req.user.id, 'reading', score, session_id, { passage_id, student_answers, time_taken_seconds });
    res.json(result);
  } catch (err) {
    console.error('[lsrw] reading evaluate:', err.message);
    return error(res, 'Evaluation failed. Please try again.', 500);
  }
});

// ─── Writing ──────────────────────────────────────────────────────────────────

router.get('/writing/prompts', authMiddleware, (req, res) => {
  res.json({ prompts: WRITING_PROMPTS });
});

// 30 AI-generated prompts for a level (beginner | intermediate | advanced), cached.
router.get('/writing/pool/:level', authMiddleware, async (req, res) => {
  const level = POOL_LEVELS.includes(req.params.level) ? req.params.level : 'beginner';
  try {
    const prompts = await WRITING_POOL.get(level);
    res.json({ level, prompts });
  } catch (e) {
    console.error('[lsrw] writing pool:', e?.message);
    // Last resort: seed prompts for that level so the page still renders.
    res.json({ level, prompts: WRITING_PROMPTS.filter(w => w.level === level) });
  }
});

router.post('/writing/start-session', authMiddleware, async (req, res) => {
  try {
    const { student_id, content_id } = req.query;
    const sessionId = await saveSession(student_id || req.user.id, 'writing', content_id);
    res.json({ session_id: sessionId });
  } catch (e) {
    res.json({ session_id: crypto.randomUUID() });
  }
});

router.post('/writing/evaluate', authMiddleware, async (req, res) => {
  try {
    const { prompt: writingPrompt, student_text, time_taken_seconds, target_word_count, student_id, session_id } = req.body;
    if (!student_text?.trim()) return error(res, 'student_text is required');

    const wordCount = student_text.trim().split(/\s+/).filter(Boolean).length;

    const prompt = `You are an English writing evaluator for Indian engineering students.

PROMPT: ${writingPrompt}
TARGET WORD COUNT: ${target_word_count}
ACTUAL WORD COUNT: ${wordCount}
TIME TAKEN: ${time_taken_seconds || '?'}s

STUDENT ESSAY:
${student_text}

Evaluate grammar, vocabulary, coherence, task achievement, and word count compliance.
Each correction must quote text copied EXACTLY from the student's essay in "original",
give the fixed version in "suggestion", and say why in one short sentence.
Only include corrections for text that genuinely appears in the essay — never invent examples.
If the essay has no errors worth correcting, return "corrections": [].
Return ONLY valid JSON (no markdown, no trailing commas):
{
  "score": <0-100>,
  "feedback": "<3-4 sentence overall feedback with specific examples from their writing>",
  "grammar": <0-100>,
  "vocabulary": <0-100>,
  "coherence": <0-100>,
  "task_achievement": <0-100>,
  "word_count_score": <0-100>,
  "corrections": [{"original":"<exact text from the essay>","suggestion":"<corrected text>","reason":"<why, one short sentence>"}],
  "strengths": ["<point>"],
  "improvements": ["<point>"]
}`;

    const result = await aiEvaluate(prompt);
    // Wrap individual dimension scores in sub_scores
    if (!result.sub_scores && (result.grammar || result.vocabulary)) {
      result.sub_scores = {
        grammar: result.grammar,
        vocabulary: result.vocabulary,
        coherence: result.coherence,
        task_achievement: result.task_achievement,
        word_count_score: result.word_count_score,
      };
    }
    result.corrections = normaliseCorrections(result.corrections);
    result.word_count = wordCount;
    await saveEvaluation(student_id || req.user.id, 'writing', result.score || 60, session_id, { writingPrompt, student_text, wordCount });
    res.json(result);
  } catch (err) {
    console.error('[lsrw] writing evaluate:', err.message);
    return error(res, 'Evaluation failed. Please try again.', 500);
  }
});

// ─── Progress & History ───────────────────────────────────────────────────────

router.get('/evaluations/progress/:student_id', authMiddleware, async (req, res) => {
  const sid = req.params.student_id;
  // Students can only view their own; staff can view anyone
  if (req.user.role === 'student' && req.user.id !== sid) {
    return error(res, 'Access denied', 403);
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('lsrw_evaluations')
    .select('skill_type, score')
    .eq('student_id', sid);

  if (dbErr) return res.json({ progress: [] });

  const grouped = {};
  for (const row of data || []) {
    if (!grouped[row.skill_type]) grouped[row.skill_type] = { skill_type: row.skill_type, sessions_count: 0, total_score: 0 };
    grouped[row.skill_type].sessions_count++;
    grouped[row.skill_type].total_score += row.score || 0;
  }

  const progress = Object.values(grouped).map(g => ({
    skill_type: g.skill_type,
    sessions_count: g.sessions_count,
    average_score: g.sessions_count ? Math.round(g.total_score / g.sessions_count) : 0,
  }));

  res.json({ progress });
});

router.get('/evaluations/recent/:student_id', authMiddleware, async (req, res) => {
  const sid = req.params.student_id;
  if (req.user.role === 'student' && req.user.id !== sid) {
    return error(res, 'Access denied', 403);
  }

  const { data } = await supabaseAdmin
    .from('lsrw_evaluations')
    .select('id, skill_type, score, created_at')
    .eq('student_id', sid)
    .order('created_at', { ascending: false })
    .limit(10);

  res.json({ recent: data || [] });
});

// ─── CSV export (opens directly in Excel) ───────────────────────────────────────

const SKILL_LABEL = { listening: 'Listening', speaking: 'Speaking', reading: 'Reading', writing: 'Writing' };

// Escape one CSV cell per RFC 4180: wrap in quotes if it contains a comma,
// quote or newline, and double any inner quotes.
function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// A short, human-readable summary of an attempt's metadata (shape varies by skill).
function evaluationDetails(skill, m = {}) {
  const clip = (t, n = 80) => String(t).replace(/\s+/g, ' ').trim().slice(0, n);
  switch (skill) {
    case 'writing':   return m.wordCount != null ? `Words: ${m.wordCount}` : (m.writingPrompt ? `Prompt: ${clip(m.writingPrompt)}` : '');
    case 'reading':   return m.time_taken_seconds != null ? `Time: ${m.time_taken_seconds}s` : '';
    case 'speaking':  return m.topic_prompt ? `Topic: ${clip(m.topic_prompt)}` : '';
    case 'listening': return Array.isArray(m.questions) ? `Questions: ${m.questions.length}` : '';
    default:          return '';
  }
}

router.get('/evaluations/export/:student_id', authMiddleware, async (req, res) => {
  const sid = req.params.student_id;
  if (req.user.role === 'student' && req.user.id !== sid) {
    return error(res, 'Access denied', 403);
  }

  const { data, error: dbErr } = await supabaseAdmin
    .from('lsrw_evaluations')
    .select('skill_type, score, metadata, created_at')
    .eq('student_id', sid)
    .order('created_at', { ascending: false });

  if (dbErr) return error(res, 'Could not export results. Please try again.', 500);

  const rows = data || [];
  const header = ['Date', 'Time', 'Skill', 'Score (%)', 'Details'];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    const d = new Date(r.created_at);
    const date = Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    const time = Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(11, 16);
    lines.push([
      date,
      time,
      SKILL_LABEL[r.skill_type] || r.skill_type,
      r.score ?? '',
      evaluationDetails(r.skill_type, r.metadata),
    ].map(csvCell).join(','));
  }

  // ﻿ BOM so Excel reads UTF-8 (accents, symbols) correctly.
  const csv = '﻿' + lines.join('\r\n') + '\r\n';
  const filename = `lsrw-results-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

module.exports = router;
