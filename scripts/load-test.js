/**
 * Orbivex Load Test — 100 to 150 concurrent virtual students
 * ──────────────────────────────────────────────────────────
 * Spawns N virtual users that each run the realistic student journey:
 *   login → /me → list courses → list enrolled → fetch one lesson →
 *   fetch quiz → submit quiz → list tests → analytics dashboard
 *
 * Reports per-endpoint p50 / p95 / p99 / max latency, error rate, throughput.
 *
 * Usage:
 *   node scripts/load-test.js                        # default 100 users, 1 round
 *   node scripts/load-test.js --users=150 --rounds=3
 *   node scripts/load-test.js --users=120 --ramp=10  # ramp 10 users/sec
 *   node scripts/load-test.js --skip-quiz-submit     # skip writes
 *
 * Env:
 *   API_URL          default http://localhost:3001
 *   STUDENT_EMAIL    default student@orbivex.com
 *   STUDENT_PASSWORD default student123
 *
 * Requirements:
 *   - Node 18+ (global fetch)
 *   - The student account must exist (run `node seed.js` from backend/)
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const STUDENT_EMAIL = process.env.STUDENT_EMAIL || 'student@orbivex.com';
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD || 'student123';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const USERS = parseInt(args.users || '100', 10);
const ROUNDS = parseInt(args.rounds || '1', 10);
const RAMP_PER_SEC = parseInt(args.ramp || '20', 10);
const SKIP_QUIZ_SUBMIT = !!args['skip-quiz-submit'];

// ─── color helpers ───
const c = (n, s) => `\x1b[${n}m${s}\x1b[0m`;
const green = (s) => c(32, s);
const red = (s) => c(31, s);
const yellow = (s) => c(33, s);
const cyan = (s) => c(36, s);
const dim = (s) => c(90, s);

// ─── metrics ───
const metrics = {}; // endpoint → { times: [], errors: 0, statuses: {} }

function record(endpoint, ms, ok, status) {
  const m = (metrics[endpoint] ||= { times: [], errors: 0, statuses: {} });
  m.times.push(ms);
  if (!ok) m.errors++;
  m.statuses[status] = (m.statuses[status] || 0) + 1;
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function call(token, method, path, body) {
  const t0 = Date.now();
  let status = 0;
  let ok = false;
  let json = null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    const text = await res.text();
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    ok = status >= 200 && status < 300 && (json.success !== false);
  } catch (err) {
    status = -1;
    json = { error: err.message };
  }
  const ms = Date.now() - t0;
  record(`${method} ${path.split('?')[0].replace(/\/[a-f0-9-]{8,}/gi, '/:id')}`, ms, ok, status);
  return { status, json, ms, ok };
}

// ─── single virtual user ───
async function virtualUser(id) {
  // 1. login (each VU gets its own token to avoid shared-state effects)
  const login = await call(null, 'POST', '/api/auth/login', {
    email: STUDENT_EMAIL,
    password: STUDENT_PASSWORD,
  });
  if (!login.ok) return { id, fatal: 'login failed: ' + login.status };
  const token = login.json?.data?.token;
  if (!token) return { id, fatal: 'no token in login response' };

  // 2. me
  await call(token, 'GET', '/api/auth/me');

  // 3. courses list
  const courses = await call(token, 'GET', '/api/courses');
  const firstCourse = courses.json?.data?.[0];

  // 4. my enrolled
  await call(token, 'GET', '/api/courses/my/enrolled').catch(() => {});

  // 5. one course detail + its lessons
  if (firstCourse?.id) {
    await call(token, 'GET', `/api/courses/${firstCourse.id}`);
    const lessons = await call(token, 'GET', `/api/lessons?course_id=${firstCourse.id}`);
    const firstLesson = lessons.json?.data?.[0];

    // 6. quiz fetch + (optional) submit
    if (firstLesson?.id) {
      const quiz = await call(token, 'GET', `/api/quizzes/lesson/${firstLesson.id}`);
      if (!SKIP_QUIZ_SUBMIT && quiz.ok && quiz.json?.data?.id) {
        const q = quiz.json.data;
        const numQ = Array.isArray(q.questions_json) ? q.questions_json.length : 0;
        const answers = Array.from({ length: numQ }, () => 'A');
        await call(token, 'POST', '/api/quizzes/submit', { quiz_id: q.id, answers });
      }
    }
  }

  // 7. tests list
  await call(token, 'GET', '/api/tests');

  // 8. dashboard analytics
  await call(token, 'GET', '/api/analytics/dashboard').catch(() => {});

  return { id, fatal: null };
}

// ─── ramp-up scheduler ───
async function runWave(users, round) {
  console.log(cyan(`\n── Round ${round + 1}/${ROUNDS}: spawning ${users} virtual students (ramp ${RAMP_PER_SEC}/sec) ──`));
  const t0 = Date.now();
  const promises = [];
  for (let i = 0; i < users; i++) {
    promises.push(virtualUser(i + 1));
    if ((i + 1) % RAMP_PER_SEC === 0) {
      await new Promise((r) => setTimeout(r, 1000));
      process.stdout.write(dim(`  spawned ${i + 1}/${users}\r`));
    }
  }
  const results = await Promise.all(promises);
  const elapsed = (Date.now() - t0) / 1000;
  const fatals = results.filter((r) => r.fatal);
  console.log(`\n  wave done in ${elapsed.toFixed(1)}s — fatal: ${fatals.length}/${users}`);
  if (fatals.length) console.log(red(`  first fatal: ${fatals[0].fatal}`));
  return elapsed;
}

// ─── pre-flight ───
async function preflight() {
  console.log(cyan('── Pre-flight ──'));
  console.log(`API: ${API_URL}`);
  const h = await fetch(`${API_URL}/api/health`).then((r) => r.json()).catch((e) => ({ error: e.message }));
  console.log(`Health: ${JSON.stringify(h)}`);
  if (h?.database !== 'connected') {
    console.log(red('Database not connected — load test will mostly 500. Start the backend API first.'));
    process.exit(2);
  }
  if (h?.ai?.status !== 'configured') {
    console.log(yellow('No AI provider configured — AI endpoints will fail (load test does not call them).'));
  }
}

// ─── report ───
function report(totalElapsed) {
  console.log(cyan('\n── Per-endpoint latency (ms) ──'));
  const rows = [['endpoint', 'count', 'p50', 'p95', 'p99', 'max', 'errors', 'err%']];
  for (const [ep, m] of Object.entries(metrics)) {
    const errPct = ((m.errors / m.times.length) * 100).toFixed(1);
    rows.push([
      ep,
      String(m.times.length),
      String(pct(m.times, 50)),
      String(pct(m.times, 95)),
      String(pct(m.times, 99)),
      String(Math.max(...m.times)),
      String(m.errors),
      errPct + '%',
    ]);
  }
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  rows.forEach((r, i) => {
    const line = r.map((cell, j) => cell.padEnd(widths[j])).join('  ');
    if (i === 0) console.log(dim(line));
    else {
      const errCount = parseInt(r[6], 10);
      console.log(errCount > 0 ? red(line) : green(line));
    }
  });

  // status code summary
  console.log(cyan('\n── HTTP status summary per endpoint ──'));
  for (const [ep, m] of Object.entries(metrics)) {
    const codes = Object.entries(m.statuses).map(([s, n]) => `${s}:${n}`).join(' ');
    console.log(`  ${ep.padEnd(40)} ${codes}`);
  }

  const totalReq = Object.values(metrics).reduce((sum, m) => sum + m.times.length, 0);
  const totalErr = Object.values(metrics).reduce((sum, m) => sum + m.errors, 0);
  const rps = (totalReq / totalElapsed).toFixed(1);

  console.log(cyan('\n── Totals ──'));
  console.log(`  Virtual users:    ${USERS} × ${ROUNDS} rounds`);
  console.log(`  Total requests:   ${totalReq}`);
  console.log(`  Total errors:     ${totalErr === 0 ? green(totalErr) : red(totalErr)}  (${((totalErr / totalReq) * 100).toFixed(2)}%)`);
  console.log(`  Throughput:       ${rps} req/sec`);
  console.log(`  Wall time:        ${totalElapsed.toFixed(1)}s`);

  // verdict
  console.log(cyan('\n── Verdict ──'));
  const errRate = totalErr / totalReq;
  const slowEndpoints = Object.entries(metrics).filter(([, m]) => pct(m.times, 95) > 2000);
  if (errRate < 0.01 && slowEndpoints.length === 0) {
    console.log(green('  PASS — system handled the load smoothly.'));
  } else if (errRate < 0.05) {
    console.log(yellow('  PARTIAL — most requests succeeded but some endpoints are slow or erroring.'));
    slowEndpoints.forEach(([ep, m]) => console.log(yellow(`    slow: ${ep} p95=${pct(m.times, 95)}ms`)));
  } else {
    console.log(red(`  FAIL — error rate ${(errRate * 100).toFixed(1)}%. Investigate rate limits, DB pool, and AI provider queue.`));
  }
}

// ─── main ───
(async () => {
  await preflight();
  const t0 = Date.now();
  for (let r = 0; r < ROUNDS; r++) {
    await runWave(USERS, r);
  }
  const elapsed = (Date.now() - t0) / 1000;
  report(elapsed);
  process.exit(0);
})().catch((err) => {
  console.error(red('Fatal: ' + err.stack));
  process.exit(2);
});
