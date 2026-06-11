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
const { generateCompletion } = require('../config/ai');
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
  const { error: dbErr } = await supabaseAdmin.from('lsrw_sessions').insert({
    id: sessionId,
    student_id,
    skill_type,
    content_id,
    status: 'started',
  }).catch(() => ({ error: null })); // table may not exist yet — non-blocking
  if (dbErr) console.warn('[lsrw] saveSession warning:', dbErr.message);
  return sessionId;
}

async function saveEvaluation(student_id, skill_type, score, session_id, metadata = {}) {
  await supabaseAdmin.from('lsrw_evaluations').insert({
    student_id,
    skill_type,
    score,
    session_id,
    metadata,
  }).catch((e) => console.warn('[lsrw] saveEvaluation warning:', e?.message));
}

async function aiEvaluate(prompt) {
  const raw = await generateCompletion('advanced', prompt, {
    temperature: 0.2,
    max_tokens: 800,
    cache: false,
  });
  // Try to parse JSON, fall back to a safe default
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch {}
  return { score: 60, feedback: raw.slice(0, 600), strengths: [], improvements: [] };
}

// ─── Content Endpoints ────────────────────────────────────────────────────────

router.get('/content/all', authMiddleware, (req, res) => {
  res.json({ passages: LISTENING_PASSAGES, topics: SPEAKING_TOPICS, reading: READING_PASSAGES, prompts: WRITING_PROMPTS });
});

// ─── Listening ────────────────────────────────────────────────────────────────

router.get('/listening/passages', authMiddleware, (req, res) => {
  res.json({ passages: LISTENING_PASSAGES });
});

router.post('/listening/start-session', authMiddleware, async (req, res) => {
  const { student_id, content_id } = req.query;
  const sessionId = await saveSession(student_id || req.user.id, 'listening', content_id);
  res.json({ session_id: sessionId });
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
    result.model_used = process.env.NVIDIA_MODEL || 'local';
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

router.post('/speaking/start-session', authMiddleware, async (req, res) => {
  const { student_id, content_id } = req.query;
  const sessionId = await saveSession(student_id || req.user.id, 'speaking', content_id);
  res.json({ session_id: sessionId });
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
    result.model_used = process.env.NVIDIA_MODEL || 'local';
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

router.post('/reading/start-session', authMiddleware, async (req, res) => {
  const { student_id, content_id } = req.query;
  const sessionId = await saveSession(student_id || req.user.id, 'reading', content_id);
  res.json({ session_id: sessionId });
});

router.post('/reading/evaluate', authMiddleware, async (req, res) => {
  try {
    const { passage_id, student_answers, time_taken_seconds, student_id, session_id } = req.body;
    const passage = READING_PASSAGES.find(p => p.id === passage_id);
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

router.post('/writing/start-session', authMiddleware, async (req, res) => {
  const { student_id, content_id } = req.query;
  const sessionId = await saveSession(student_id || req.user.id, 'writing', content_id);
  res.json({ session_id: sessionId });
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
Return ONLY valid JSON:
{
  "score": <0-100>,
  "feedback": "<3-4 sentence overall feedback with specific examples from their writing>",
  "grammar": <0-100>,
  "vocabulary": <0-100>,
  "coherence": <0-100>,
  "task_achievement": <0-100>,
  "word_count_score": <0-100>,
  "corrections": ["<specific correction 1>", "<specific correction 2>"],
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
    result.word_count = wordCount;
    result.model_used = process.env.NVIDIA_MODEL || 'local';
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
    .eq('student_id', sid)
    .catch(() => ({ data: [], error: null }));

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
    .limit(10)
    .catch(() => ({ data: [] }));

  res.json({ recent: data || [] });
});

module.exports = router;
