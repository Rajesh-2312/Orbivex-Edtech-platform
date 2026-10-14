/**
 * AI Services Validator
 * ─────────────────────
 * Hits each /api/ai/* endpoint once and validates:
 *   1. Response shape (correct fields present)
 *   2. JSON parseability
 *   3. Latency
 *   4. AI provider health
 *
 * Then runs an optional concurrency stress test (--concurrent=N) to verify
 * the AI queue/cache holds up.
 *
 * Usage:
 *   node scripts/ai-validator.js                 # one shot per endpoint
 *   node scripts/ai-validator.js --concurrent=5  # 5 parallel quiz-gen calls
 *   node scripts/ai-validator.js --skip-slow     # skip course gen + grading
 *
 * Env:
 *   API_URL          default http://localhost:3001
 *   STUDENT_EMAIL    default student@orbivex.com
 *   STUDENT_PASSWORD default student123
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const EMAIL = process.env.STUDENT_EMAIL || 'student@orbivex.com';
const PASSWORD = process.env.STUDENT_PASSWORD || 'student123';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);
const CONCURRENT = parseInt(args.concurrent || '0', 10);
const SKIP_SLOW = !!args['skip-slow'];

const c = (n, s) => `\x1b[${n}m${s}\x1b[0m`;
const ok = (s) => console.log(c(32, '✔ ') + s);
const fail = (s) => console.log(c(31, '✘ ') + s);
const info = (s) => console.log(c(36, 'ℹ ') + s);
const section = (s) => console.log('\n' + c(35, '── ' + s + ' ──'));

let TOKEN = null;
const results = [];

async function req(method, path, body) {
  const t0 = Date.now();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  const ms = Date.now() - t0;
  return { status: res.status, json, ms };
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    results.push({ name, pass: true, ms });
    ok(`${name}  ${c(90, ms + 'ms')}`);
  } catch (err) {
    const ms = Date.now() - t0;
    results.push({ name, pass: false, ms, err: err.message });
    fail(`${name}  ${c(90, ms + 'ms')}  →  ${err.message}`);
  }
}

function must(cond, msg) { if (!cond) throw new Error(msg); }

// Sample lesson content used for AI generation
const SAMPLE_CONTENT = `
JavaScript closures: A closure is the combination of a function bundled together
with references to its surrounding state (the lexical environment). Closures give
you access to an outer function's scope from an inner function. In JavaScript,
closures are created every time a function is created, at function creation time.
Common uses: data privacy, partial application, function factories.
`.trim();

const SAMPLE_ASSIGNMENT = `
A closure in JavaScript is when a function remembers variables from where it was
made. For example, if you make a counter function inside another function, the
inner function still knows about the count even after the outer function ends.
`.trim();

async function run() {
  section('Login + Health');

  await step('login as student', async () => {
    const { status, json } = await req('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
    must(status === 200 && json.success, `login: ${JSON.stringify(json).slice(0, 200)}`);
    TOKEN = json.data.token;
    must(TOKEN, 'no token');
  });

  await step('GET /api/health — AI provider status', async () => {
    const { status, json } = await req('GET', '/api/health');
    must(status === 200, `health: ${status}`);
    info(`  ai=${json.ai?.status} nvidia=${json.ai?.providers?.nvidia?.status} openrouter=${json.ai?.providers?.openrouter?.status}`);
    if (json.ai?.status !== 'configured') {
      throw new Error('No AI provider configured — AI tests will all fail. Set NVIDIA_API_KEY and/or OPENROUTER_API_KEY.');
    }
  });

  section('AI endpoints — single-shot smoke test');

  await step('POST /api/ai/generate-quiz (3 questions)', async () => {
    const { status, json } = await req('POST', '/api/ai/generate-quiz', {
      content: SAMPLE_CONTENT,
      num_questions: 3,
    });
    must(status === 200 && json.success, JSON.stringify(json).slice(0, 300));
    const qs = json.data.questions;
    must(Array.isArray(qs) && qs.length >= 1, 'no questions returned');
    must(qs[0].question && qs[0].options && qs[0].correct_answer,
      'question shape wrong: ' + JSON.stringify(qs[0]).slice(0, 200));
    info(`  got ${qs.length} questions`);
  });

  await step('POST /api/ai/summarize', async () => {
    const { status, json } = await req('POST', '/api/ai/summarize', { content: SAMPLE_CONTENT });
    must(status === 200 && json.success, JSON.stringify(json).slice(0, 300));
    must(json.data.summary, 'no summary field');
    must(Array.isArray(json.data.key_points), 'key_points missing');
  });

  await step('POST /api/ai/recommend-lessons', async () => {
    const { status, json } = await req('POST', '/api/ai/recommend-lessons', {});
    must(status === 200 && json.success, JSON.stringify(json).slice(0, 300));
    must(Array.isArray(json.data.recommendations), 'recommendations missing');
  });

  await step('POST /api/ai/check-plagiarism', async () => {
    const { status, json } = await req('POST', '/api/ai/check-plagiarism', { text: SAMPLE_ASSIGNMENT });
    must(status === 200 && json.success, JSON.stringify(json).slice(0, 300));
    must(typeof json.data.plagiarism_score === 'number', 'plagiarism_score missing or wrong type');
    must(['pass', 'review', 'fail'].includes(json.data.recommendation),
      `recommendation invalid: ${json.data.recommendation}`);
  });

  if (!SKIP_SLOW) {
    await step('POST /api/ai/grade-assignment', async () => {
      const { status, json } = await req('POST', '/api/ai/grade-assignment', {
        assignment_text: SAMPLE_ASSIGNMENT,
        rubric: 'clarity, accuracy, completeness',
      });
      must(status === 200 && json.success, JSON.stringify(json).slice(0, 300));
      must(typeof json.data.score === 'number', 'score missing');
      must(json.data.feedback, 'feedback missing');
    });

    await step('POST /api/ai/generate-course (3 lessons)', async () => {
      const { status, json } = await req('POST', '/api/ai/generate-course', {
        subject: 'Intro to Async JavaScript',
        difficulty: 'beginner',
        num_lessons: 3,
        save: false,
      });
      must(status === 200 && json.success, JSON.stringify(json).slice(0, 300));
      must(json.data.outline?.title, 'no title');
      must(Array.isArray(json.data.outline?.lessons), 'no lessons');
      info(`  course: "${json.data.outline.title}" with ${json.data.outline.lessons.length} lessons`);
    });
  }

  if (CONCURRENT > 0) {
    section(`Concurrency stress: ${CONCURRENT} parallel quiz-gen calls`);
    const t0 = Date.now();
    const out = await Promise.all(
      Array.from({ length: CONCURRENT }, (_, i) =>
        req('POST', '/api/ai/generate-quiz', { content: SAMPLE_CONTENT, num_questions: 2 })
          .then((r) => ({ i, ...r }))
      )
    );
    const elapsed = (Date.now() - t0) / 1000;
    const okCount = out.filter((r) => r.status === 200 && r.json.success).length;
    const errCount = out.length - okCount;
    const latencies = out.map((r) => r.ms).sort((a, b) => a - b);
    info(`  ${okCount}/${CONCURRENT} succeeded, ${errCount} failed, total ${elapsed.toFixed(1)}s`);
    info(`  latency p50=${latencies[Math.floor(latencies.length / 2)]}ms p95=${latencies[Math.floor(latencies.length * 0.95)]}ms max=${latencies[latencies.length - 1]}ms`);
    if (errCount > 0) {
      out.filter((r) => !(r.status === 200 && r.json.success))
        .slice(0, 3)
        .forEach((r) => fail(`  call #${r.i}: status=${r.status} err=${r.json.error || JSON.stringify(r.json).slice(0, 120)}`));
    }
  }

  // ─── summary ───
  section('Summary');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const totalMs = results.reduce((s, r) => s + r.ms, 0);
  console.log(`Passed: ${c(32, passed)}   Failed: ${c(failed ? 31 : 32, failed)}   Total: ${results.length}`);
  console.log(`Total wall time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log('\nLatency by endpoint:');
  results.forEach((r) => {
    const flag = r.pass ? c(32, 'OK ') : c(31, 'FAIL');
    console.log(`  ${flag}  ${r.ms.toString().padStart(6)}ms  ${r.name}`);
  });
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
