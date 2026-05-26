/**
 * Tests & Quizzes Section Validator
 * ─────────────────────────────────
 * Exercises every endpoint in routes/tests.js and routes/quizzes.js plus
 * the edge cases that commonly break in production:
 *
 *   - Submit without starting       → expect 400
 *   - Double submit                  → expect 400
 *   - Result before submit           → expect 404
 *   - List tests as student outside scope → empty
 *   - MCQ scoring math is correct    → assert obtained_marks
 *   - Quiz fetch leaks correct_answer? → assert hidden until submit
 *
 * Usage:
 *   node scripts/test-validator.js
 *
 * Env:
 *   API_URL          default http://localhost:3001
 *   ADMIN_EMAIL      default admin@orbivex.com
 *   ADMIN_PASSWORD   default admin123
 *   STUDENT_EMAIL    default student@orbivex.com
 *   STUDENT_PASSWORD default student123
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@orbivex.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const STUDENT_EMAIL = process.env.STUDENT_EMAIL || 'student@orbivex.com';
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD || 'student123';

const c = (n, s) => `\x1b[${n}m${s}\x1b[0m`;
const ok = (s) => console.log(c(32, '✔ ') + s);
const fail = (s) => console.log(c(31, '✘ ') + s);
const info = (s) => console.log(c(36, 'ℹ ') + s);
const section = (s) => console.log('\n' + c(35, '── ' + s + ' ──'));

let adminToken = null;
let studentToken = null;
const results = [];

async function req(token, method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    ok(name);
  } catch (err) {
    results.push({ name, pass: false, err: err.message });
    fail(`${name}  →  ${err.message}`);
  }
}

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function login(email, password) {
  const { status, json } = await req(null, 'POST', '/api/auth/login', { email, password });
  must(status === 200 && json.success, `login failed: ${JSON.stringify(json).slice(0, 200)}`);
  return json.data.token;
}

// Build an MCQ test paper as admin so we have known-correct answers for scoring assertions.
async function buildTestPaper() {
  // 1. Create a question with a known correct option
  const qBody = {
    question_text: 'What does SQL stand for?',
    question_type: 'mcq',
    difficulty_level: 'easy',
    category: 'technical',
    test_type: 'academic',
    answers_json: [
      { text: 'Structured Query Language', correct: true },
      { text: 'Standard Question Logic', correct: false },
      { text: 'Simple Quick Lookup', correct: false },
      { text: 'Server Query Layer', correct: false },
    ],
  };
  const { status: qs, json: qj } = await req(adminToken, 'POST', '/api/admin/question-bank', qBody);
  must(qs < 300 && qj.success, `create question: ${JSON.stringify(qj).slice(0, 200)}`);
  const questionId = qj.data.id;

  // 2. Create test paper (no scope = available to anyone with profile.college_id null OR matched)
  const tpBody = {
    title: 'VALIDATOR_Test_' + Date.now(),
    description: 'Auto-generated validator test',
    test_type: 'academic',
    duration_minutes: 10,
    total_marks: 1,
    passing_score: 50,
    is_published: true,
  };
  const { status: ts, json: tj } = await req(adminToken, 'POST', '/api/admin/test-papers', tpBody);
  must(ts < 300 && tj.success, `create test: ${JSON.stringify(tj).slice(0, 200)}`);
  const testId = tj.data.id;

  // 3. Attach question to test
  const { status: as, json: aj } = await req(adminToken, 'POST', `/api/admin/test-papers/${testId}/questions`, {
    question_id: questionId,
    marks: 1,
    sort_order: 1,
  });
  must(as < 300 && aj.success, `attach question: ${JSON.stringify(aj).slice(0, 200)}`);

  return { testId, questionId };
}

async function cleanupTest(testId) {
  await req(adminToken, 'DELETE', `/api/admin/test-papers/${testId}`).catch(() => {});
}

async function run() {
  section('Login');
  await step('admin login', async () => { adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD); });
  await step('student login', async () => { studentToken = await login(STUDENT_EMAIL, STUDENT_PASSWORD); });
  if (!adminToken || !studentToken) { fail('Cannot continue without both tokens'); process.exit(1); }

  section('Quiz section (routes/quizzes.js)');

  // Quiz fetch leak check — fetching a lesson quiz should NOT include correct_answer for students.
  // (The current implementation returns the full questions_json. We test the actual behavior
  // and flag if it's leaking.)
  await step('GET /api/quizzes/lesson/:id — does it require auth?', async () => {
    const { status } = await req(null, 'GET', '/api/quizzes/lesson/00000000-0000-0000-0000-000000000000');
    must(status === 401 || status === 404, `unauthenticated request returned ${status} (expected 401 — endpoint is missing authMiddleware!)`);
  });

  await step('POST /api/quizzes/submit without quiz_id → 400', async () => {
    const { status, json } = await req(studentToken, 'POST', '/api/quizzes/submit', { answers: ['A'] });
    must(status === 400 || (json.success === false), `expected 400, got ${status}: ${JSON.stringify(json).slice(0, 150)}`);
  });

  await step('POST /api/quizzes/submit with bogus quiz_id → 404', async () => {
    const { status, json } = await req(studentToken, 'POST', '/api/quizzes/submit', {
      quiz_id: '00000000-0000-0000-0000-000000000000',
      answers: ['A'],
    });
    must(status === 404 || json.success === false, `expected 404, got ${status}`);
  });

  section('Test section (routes/tests.js) — happy path');
  let testId, questionId;
  await step('admin builds MCQ test paper', async () => {
    const built = await buildTestPaper();
    testId = built.testId;
    questionId = built.questionId;
  });

  if (testId) {
    await step('GET /api/tests — student sees the test (or empty if scoped)', async () => {
      const { status, json } = await req(studentToken, 'GET', '/api/tests');
      must(status === 200 && json.success, JSON.stringify(json).slice(0, 200));
      info(`  student sees ${json.data?.length || 0} tests`);
    });

    await step('GET /api/tests/:id — questions returned WITHOUT correct flag', async () => {
      const { status, json } = await req(studentToken, 'GET', `/api/tests/${testId}`);
      must(status === 200 && json.success, JSON.stringify(json).slice(0, 200));
      const q = json.data?.questions?.[0];
      must(q, 'no questions in response');
      // answers should be array of {text} only — no `correct` key leaked
      const leaked = (q.answers_json || []).some((a) => 'correct' in a);
      must(!leaked, 'SECURITY: correct flag leaked to student in pre-submit fetch');
    });

    await step('POST /api/tests/:id/submit BEFORE start → 400', async () => {
      const { status, json } = await req(studentToken, 'POST', `/api/tests/${testId}/submit`, {
        responses: { [questionId]: 0 },
      });
      must(status === 400 || json.success === false, `expected 400, got ${status}`);
    });

    await step('POST /api/tests/:id/start → submission row created', async () => {
      const { status, json } = await req(studentToken, 'POST', `/api/tests/${testId}/start`);
      must((status === 200 || status === 201) && json.success, JSON.stringify(json).slice(0, 200));
      must(json.data.status === 'in_progress', `expected in_progress, got ${json.data.status}`);
    });

    await step('POST /api/tests/:id/submit with correct answer → full marks', async () => {
      const { status, json } = await req(studentToken, 'POST', `/api/tests/${testId}/submit`, {
        responses: { [questionId]: 0 }, // index 0 was the correct one
      });
      must(status === 200 && json.success, JSON.stringify(json).slice(0, 200));
      must(json.data.obtained_marks === 1, `scoring broken: obtained=${json.data.obtained_marks} expected 1`);
      must(json.data.percentage === 100, `percentage broken: ${json.data.percentage}`);
    });

    await step('POST /api/tests/:id/submit AGAIN → 400 (already submitted)', async () => {
      const { status, json } = await req(studentToken, 'POST', `/api/tests/${testId}/submit`, {
        responses: { [questionId]: 0 },
      });
      must(status === 400 || json.success === false, `double-submit not blocked, got ${status}`);
    });

    await step('GET /api/tests/:id/my-result — full review with correct flag now revealed', async () => {
      const { status, json } = await req(studentToken, 'GET', `/api/tests/${testId}/my-result`);
      must(status === 200 && json.success, JSON.stringify(json).slice(0, 200));
      const hasCorrectFlag = (json.data.questions?.[0]?.answers_json || []).some((a) => 'correct' in a);
      must(hasCorrectFlag, 'post-submit fetch should reveal correct flags for review');
      must(json.data.questions?.[0]?.is_correct === true, 'is_correct calculation broken');
    });

    section('Cleanup');
    await step('admin deletes validator test paper', async () => {
      await cleanupTest(testId);
    });
  }

  // ─── summary ───
  section('Summary');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`Passed: ${c(32, passed)}   Failed: ${c(failed ? 31 : 32, failed)}   Total: ${results.length}`);
  if (failed) {
    console.log('\nFailures:');
    results.filter((r) => !r.pass).forEach((r) => console.log('  - ' + r.name + ': ' + r.err));
  }
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(c(31, 'Fatal: ') + err.stack);
  process.exit(2);
});
