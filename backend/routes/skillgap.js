/**
 * backend/routes/skillgap.js
 * Skill Gap Analyzer — diagnostic quiz + AI weakness analysis + study plan
 */
const express = require('express');
const router  = express.Router();
const authMiddleware  = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { success, error } = require('../utils/response');
const { generateCompletion } = require('../config/ai');

// ─── AI helper (NVIDIA NIM → OpenRouter fallback via config/ai) ────
const aiChat = (prompt, opts = {}) =>
  generateCompletion('advanced', prompt, { temperature: 0.3, max_tokens: 1536, timeoutMs: 90_000, ...opts });

function extractJSON(raw) {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const isArr   = cleaned.trimStart()[0] === '[';
  const start   = cleaned.indexOf(isArr ? '[' : '{');
  const end     = cleaned.lastIndexOf(isArr ? ']' : '}');
  if (start === -1 || end === -1) throw new Error('No JSON found in response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ── Diagnostic question bank (inline seed) ────────────────────────
const DIAGNOSTIC_QUESTIONS = {
  'Data Structures': [
    { id: 'ds1', q: 'What is the time complexity of searching in a balanced BST?', options: ['O(1)','O(log n)','O(n)','O(n log n)'], answer: 'O(log n)', topic: 'Trees' },
    { id: 'ds2', q: 'Which data structure uses LIFO?', options: ['Queue','Stack','Heap','Graph'], answer: 'Stack', topic: 'Stacks' },
    { id: 'ds3', q: 'Hash table average-case lookup is:', options: ['O(n)','O(log n)','O(1)','O(n²)'], answer: 'O(1)', topic: 'Hashing' },
    { id: 'ds4', q: 'In a max-heap, the root contains:', options: ['Smallest','Largest','Median','Any'], answer: 'Largest', topic: 'Heaps' },
    { id: 'ds5', q: 'Which traversal visits left → root → right?', options: ['Pre-order','In-order','Post-order','Level-order'], answer: 'In-order', topic: 'Trees' },
  ],
  'Algorithms': [
    { id: 'al1', q: 'Quicksort worst-case complexity?', options: ['O(n log n)','O(n²)','O(n)','O(log n)'], answer: 'O(n²)', topic: 'Sorting' },
    { id: 'al2', q: 'Dijkstra\'s algorithm finds:', options: ['MST','Shortest path','All pairs','Topological order'], answer: 'Shortest path', topic: 'Graphs' },
    { id: 'al3', q: 'Dynamic Programming uses:', options: ['Recursion only','Memoization/tabulation','Greedy choice','Divide & conquer only'], answer: 'Memoization/tabulation', topic: 'DP' },
    { id: 'al4', q: 'BFS uses which data structure?', options: ['Stack','Queue','Heap','Array'], answer: 'Queue', topic: 'Graphs' },
    { id: 'al5', q: 'Merge sort time complexity:', options: ['O(n²)','O(n log n)','O(log n)','O(n)'], answer: 'O(n log n)', topic: 'Sorting' },
  ],
  'OOP / Java': [
    { id: 'oo1', q: 'Which OOP principle restricts direct data access?', options: ['Inheritance','Polymorphism','Encapsulation','Abstraction'], answer: 'Encapsulation', topic: 'OOP Basics' },
    { id: 'oo2', q: 'Method overloading is an example of:', options: ['Runtime polymorphism','Compile-time polymorphism','Inheritance','Abstraction'], answer: 'Compile-time polymorphism', topic: 'Polymorphism' },
    { id: 'oo3', q: 'In Java, interface methods are by default:', options: ['private','protected','public abstract','static'], answer: 'public abstract', topic: 'Interfaces' },
    { id: 'oo4', q: 'Which keyword prevents class inheritance in Java?', options: ['static','abstract','final','sealed'], answer: 'final', topic: 'Java Basics' },
    { id: 'oo5', q: 'What does JVM stand for?', options: ['Java Virtual Memory','Java Virtual Machine','Java Variable Manager','None'], answer: 'Java Virtual Machine', topic: 'Java Basics' },
  ],
  'DBMS': [
    { id: 'db1', q: 'ACID in databases stands for:', options: ['Atomicity,Consistency,Isolation,Durability','Async,Commit,Index,Delete','All of the above','None'], answer: 'Atomicity,Consistency,Isolation,Durability', topic: 'Transactions' },
    { id: 'db2', q: 'Normalization eliminates:', options: ['Indexes','Redundancy','Joins','Constraints'], answer: 'Redundancy', topic: 'Normalization' },
    { id: 'db3', q: 'PRIMARY KEY constraint ensures:', options: ['Uniqueness only','Uniqueness + Not Null','Not Null only','Foreign reference'], answer: 'Uniqueness + Not Null', topic: 'Keys' },
    { id: 'db4', q: 'SQL HAVING clause filters:', options: ['Rows before grouping','Groups after GROUP BY','Individual columns','Joins'], answer: 'Groups after GROUP BY', topic: 'SQL' },
    { id: 'db5', q: 'Deadlock in DBMS is:', options: ['Slow query','Circular wait between transactions','Index corruption','None'], answer: 'Circular wait between transactions', topic: 'Concurrency' },
  ],
  'OS & Networks': [
    { id: 'os1', q: 'Semaphore is used for:', options: ['Memory allocation','Process synchronization','Disk scheduling','File indexing'], answer: 'Process synchronization', topic: 'OS Sync' },
    { id: 'os2', q: 'Virtual memory allows:', options: ['Faster CPU','RAM extension via disk','Better GPU','None'], answer: 'RAM extension via disk', topic: 'Memory' },
    { id: 'os3', q: 'HTTP uses which port by default?', options: ['21','22','80','443'], answer: '80', topic: 'Networking' },
    { id: 'os4', q: 'TCP guarantees:', options: ['Speed','Ordered, reliable delivery','No headers','UDP-style'], answer: 'Ordered, reliable delivery', topic: 'Networking' },
    { id: 'os5', q: 'Which scheduling is best for real-time systems?', options: ['FCFS','Round Robin','Priority','Preemptive Priority'], answer: 'Preemptive Priority', topic: 'Scheduling' },
  ],
};

// ── GET /api/skillgap/questions ───────────────────────────────────
// Returns diagnostic questions for selected subjects
router.get('/questions', authMiddleware, (req, res) => {
  const subjects = req.query.subjects
    ? req.query.subjects.split(',').filter(s => DIAGNOSTIC_QUESTIONS[s])
    : Object.keys(DIAGNOSTIC_QUESTIONS);

  const questions = subjects.flatMap(subject =>
    DIAGNOSTIC_QUESTIONS[subject].map(q => ({
      id: q.id, subject, question: q.q, options: q.options,
    }))
  );

  return success(res, { questions, total: questions.length });
});

// ── POST /api/skillgap/analyze ────────────────────────────────────
// Body: { answers: { [questionId]: selectedAnswer } }
// Returns: { score, weak_topics, strong_topics, study_plan, ai_analysis }
router.post('/analyze', authMiddleware, async (req, res) => {
  const { answers = {} } = req.body;
  if (Object.keys(answers).length === 0) return error(res, 'No answers provided');

  // Score the diagnostic
  const allQ = Object.values(DIAGNOSTIC_QUESTIONS).flat();
  const results = allQ.map(q => ({
    id: q.id, subject: '', question: q.q, topic: q.topic,
    correct: q.answer, given: answers[q.id] || null,
    is_correct: answers[q.id] === q.answer,
  }));

  // Find the subject for each question
  for (const [subj, qs] of Object.entries(DIAGNOSTIC_QUESTIONS)) {
    for (const q of qs) {
      const r = results.find(r => r.id === q.id);
      if (r) r.subject = subj;
    }
  }

  const answered = results.filter(r => r.given !== null);
  const correct  = answered.filter(r => r.is_correct);
  const score    = answered.length > 0
    ? Math.round((correct.length / answered.length) * 100)
    : 0;

  // Group by topic for weak/strong analysis
  const topicStats = {};
  for (const r of answered) {
    if (!topicStats[r.topic]) topicStats[r.topic] = { correct: 0, total: 0, subject: r.subject };
    topicStats[r.topic].total++;
    if (r.is_correct) topicStats[r.topic].correct++;
  }

  const weak_topics   = Object.entries(topicStats)
    .filter(([, s]) => s.correct / s.total < 0.5)
    .map(([t, s]) => ({ topic: t, subject: s.subject, accuracy: Math.round(s.correct / s.total * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const strong_topics = Object.entries(topicStats)
    .filter(([, s]) => s.correct / s.total >= 0.7)
    .map(([t, s]) => ({ topic: t, subject: s.subject, accuracy: Math.round(s.correct / s.total * 100) }));

  // AI analysis + study plan
  const weakList = weak_topics.map(w => `${w.topic} (${w.accuracy}% accuracy)`).join(', ') || 'None identified';
  const prompt = `You are an expert placement coaching AI for Indian engineering students.

A student scored ${score}% on a technical diagnostic test.
Weak topics: ${weakList}
Strong topics: ${strong_topics.map(s => s.topic).join(', ') || 'None identified'}

Provide a personalized study plan as JSON:
{
  "analysis": "2-sentence honest assessment of the student",
  "priority_order": ["topic1", "topic2", ...],
  "weekly_plan": [
    { "week": 1, "focus": "topic", "goals": ["goal1", "goal2"], "resources": ["resource1"] },
    { "week": 2, "focus": "topic", "goals": ["goal1"], "resources": ["resource1"] }
  ],
  "quick_wins": ["tip1", "tip2", "tip3"],
  "estimated_weeks_to_ready": 4
}

Be specific to Indian engineering curriculum (JNTU, VTU, Anna University). Return ONLY valid JSON.`;

  let ai_analysis = null;
  let study_plan  = null;
  try {
    const raw  = await aiChat(prompt);
    const parsed = extractJSON(raw);
    ai_analysis = parsed.analysis;
    study_plan  = parsed;
  } catch (e) {
    console.error('[skillgap/analyze] AI error:', e.message);
    // Fallback rule-based study plan
    study_plan = {
      analysis: `You scored ${score}%. Focus on weak areas to improve placement readiness.`,
      priority_order: weak_topics.map(w => w.topic),
      weekly_plan: weak_topics.slice(0, 4).map((w, i) => ({
        week: i + 1, focus: w.topic,
        goals: [`Master ${w.topic} fundamentals`, `Solve 10 practice problems`],
        resources: ['GeeksForGeeks', 'LeetCode', 'Orbivex Company Prep'],
      })),
      quick_wins: ['Practice 1 DSA problem daily', 'Revise DBMS SQL queries', 'Mock 1 interview per week'],
      estimated_weeks_to_ready: Math.max(4, weak_topics.length * 2),
    };
    ai_analysis = study_plan.analysis;
  }

  // Save result to DB (best-effort)
  try {
    await supabaseAdmin.from('skill_gap_results').upsert({
      student_id: req.user.id,
      score,
      weak_topics: weak_topics.map(w => w.topic),
      strong_topics: strong_topics.map(s => s.topic),
      study_plan,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id' });
  } catch (dbErr) {
    console.warn('[skillgap] DB save skipped:', dbErr.message);
  }

  return success(res, {
    score,
    weak_topics,
    strong_topics,
    topic_stats: topicStats,
    study_plan,
    ai_analysis,
    results: results.filter(r => r.given !== null),
  });
});

// ── GET /api/skillgap/result ──────────────────────────────────────
router.get('/result', authMiddleware, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('skill_gap_results')
    .select('*')
    .eq('student_id', req.user.id)
    .single();

  return success(res, { result: data || null });
});

module.exports = router;
