/**
 * Admin E2E Test Script
 * ─────────────────────
 * Drives the live admin API as an authenticated admin user and verifies every
 * admin-surface feature end-to-end. Creates TEST_-prefixed sample data:
 *
 *   2 colleges × (2 branches × 1 section) × 5 students × 2 educators
 *   + question bank (academic: java/python/dbms, aptitude, verbal) via AI
 *   + AI-generated course + manual course + lessons
 *   + course_access scoped to a section
 *
 * Usage:
 *   node scripts/admin-e2e-test.js                  # run full suite
 *   node scripts/admin-e2e-test.js --cleanup        # delete TEST_ rows & exit
 *   node scripts/admin-e2e-test.js --skip-ai        # skip Ollama-dependent steps
 *
 * Env:
 *   API_URL           default http://localhost:3001
 *   ADMIN_EMAIL       default admin@orbivex.com
 *   ADMIN_PASSWORD    default admin123
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@orbivex.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const PREFIX = 'TEST_';
const args = new Set(process.argv.slice(2));
const SKIP_AI = args.has('--skip-ai');
const CLEANUP_ONLY = args.has('--cleanup');

// Node 18+ has global fetch.
let TOKEN = null;
const results = [];
const created = {
  colleges: [],
  branches: [],
  sections: [],
  students: [],
  educators: [],
  courses: [],
  lessons: [],
  questions: [],
  access: [],
};

// ───────── helpers ─────────
const color = (c, s) => `\x1b[${c}m${s}\x1b[0m`;
const ok = (s) => console.log(color(32, '✔ ') + s);
const fail = (s) => console.log(color(31, '✘ ') + s);
const info = (s) => console.log(color(36, 'ℹ ') + s);
const section = (s) => console.log('\n' + color(35, '── ' + s + ' ──'));

async function api(method, path, body) {
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
  return { status: res.status, json };
}

async function step(name, fn) {
  try {
    const result = await fn();
    results.push({ name, pass: true });
    ok(name);
    return result;
  } catch (err) {
    results.push({ name, pass: false, err: err.message });
    fail(`${name}  →  ${err.message}`);
    return null;
  }
}

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ───────── login ─────────
async function login() {
  const { status, json } = await api('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  must(status === 200 && json.success, `login failed: ${JSON.stringify(json)}`);
  TOKEN = json.data.token;
  must(TOKEN, 'no token returned');
}

// ───────── cleanup ─────────
async function cleanup() {
  section('Cleanup TEST_ rows');
  // Colleges cascade to branches/sections; students/educators must be deleted
  // by user id — we rely on display_name prefix + role.
  const { json: students } = await api('GET', '/api/admin/students?limit=500');
  for (const s of students?.data || []) {
    if ((s.display_name || '').startsWith(PREFIX)) {
      await api('DELETE', `/api/admin/students/${s.id}`);
    }
  }
  const { json: educators } = await api('GET', '/api/admin/educators');
  for (const e of educators?.data || []) {
    const name = e.profiles?.display_name || e.display_name || '';
    if (name.startsWith(PREFIX)) {
      await api('DELETE', `/api/admin/educators/${e.id}`);
    }
  }
  const { json: courses } = await api('GET', '/api/admin/courses');
  for (const c of courses?.data || []) {
    if ((c.title || '').startsWith(PREFIX)) {
      await api('DELETE', `/api/admin/courses/${c.id}`);
    }
  }
  const { json: colleges } = await api('GET', '/api/admin/colleges');
  for (const c of colleges?.data || []) {
    if ((c.name || '').startsWith(PREFIX)) {
      await api('DELETE', `/api/admin/colleges/${c.id}`);
    }
  }
  ok('Cleanup done');
}

// ───────── test suite ─────────
async function run() {
  section('Login');
  await step('POST /api/auth/login (admin)', login);
  must(TOKEN, 'abort: no admin token');

  if (CLEANUP_ONLY) {
    await cleanup();
    return;
  }

  // 1. Colleges + branches + sections
  section('1. Colleges / Branches / Sections');
  for (let i = 1; i <= 2; i++) {
    const college = await step(`Create college ${PREFIX}College${i}`, async () => {
      const { status, json } = await api('POST', '/api/admin/colleges', {
        name: `${PREFIX}College${i}`,
        code: `${PREFIX}C${i}`,
        address: '123 Test Lane',
        type: 'Engineering',
        principal_email: `principal${i}@test.local`,
        phone: '+10000000000',
      });
      must(status === 200 || status === 201, `status=${status} body=${JSON.stringify(json)}`);
      must(json.success && json.data?.id, 'no id');
      return json.data;
    });
    if (!college) continue;
    created.colleges.push(college);

    for (const branchName of ['CSE', 'ECE']) {
      const branch = await step(`Create branch ${branchName} in ${college.name}`, async () => {
        const { status, json } = await api('POST', `/api/admin/colleges/${college.id}/branches`, {
          name: branchName,
          code: branchName,
          hod_name: `${PREFIX}HOD ${branchName}`,
          hod_email: `hod-${branchName.toLowerCase()}${i}@test.local`,
        });
        must(status < 300 && json.success, JSON.stringify(json));
        return json.data;
      });
      if (!branch) continue;
      created.branches.push(branch);

      const sec = await step(`Create section A in ${branchName}`, async () => {
        const { status, json } = await api('POST', `/api/admin/branches/${branch.id}/sections`, {
          section_name: 'A',
          academic_year: '2025-2026',
          semester: 1,
        });
        must(status < 300 && json.success, JSON.stringify(json));
        return json.data;
      });
      if (sec) created.sections.push({ ...sec, branch_id: branch.id, college_id: college.id });
    }
  }

  // 2. Students — 5 per college into first section of that college
  section('2. Students');
  for (const college of created.colleges) {
    const section1 = created.sections.find((s) => s.college_id === college.id);
    if (!section1) { fail(`no section for ${college.name}`); continue; }
    for (let n = 1; n <= 5; n++) {
      const email = `${PREFIX.toLowerCase()}stu-${college.code.toLowerCase()}-${n}@test.local`;
      const student = await step(`Create student ${email}`, async () => {
        const { status, json } = await api('POST', '/api/admin/students', {
          email,
          password: 'student123',
          display_name: `${PREFIX}Student ${college.code} #${n}`,
          college_id: college.id,
          branch_id: section1.branch_id,
          section_id: section1.id,
          enrollment_number: `${college.code}-${n.toString().padStart(4, '0')}`,
          hall_ticket_number: `${college.code}H${n.toString().padStart(4, '0')}`,
        });
        must(status < 300 && json.success, JSON.stringify(json));
        return json.data;
      });
      if (student) created.students.push(student);
    }
  }

  // 3. Educators — 2 per college, assigned to first section
  section('3. Educators');
  for (const college of created.colleges) {
    const section1 = created.sections.find((s) => s.college_id === college.id);
    for (let n = 1; n <= 2; n++) {
      const email = `${PREFIX.toLowerCase()}edu-${college.code.toLowerCase()}-${n}@test.local`;
      const educator = await step(`Create educator ${email}`, async () => {
        const { status, json } = await api('POST', '/api/admin/educators', {
          email,
          password: 'educator123',
          display_name: `${PREFIX}Educator ${college.code} #${n}`,
          college_id: college.id,
          branch_id: section1?.branch_id,
          qualification: 'M.Tech',
          specialization: n === 1 ? 'Java / DBMS' : 'Python / Aptitude',
          experience_years: 5 + n,
        });
        must(status < 300 && json.success, JSON.stringify(json));
        return json.data;
      });
      if (educator) created.educators.push(educator);
    }
  }

  // 4. AI question generation (technical + aptitude + verbal)
  section('4. AI question generation');
  if (SKIP_AI) {
    info('Skipped (--skip-ai)');
  } else {
    const topics = [
      { category: 'technical', test_type: 'academic', subject: 'Java',
        content: 'Java is a class-based, object-oriented programming language. Key concepts: classes, objects, inheritance, polymorphism, encapsulation, abstraction, interfaces, exception handling, generics, collections framework, threads.' },
      { category: 'technical', test_type: 'academic', subject: 'Python',
        content: 'Python is a high-level, interpreted language. Core features: dynamic typing, first-class functions, list/dict comprehensions, decorators, generators, context managers, the GIL, duck typing, and a rich standard library.' },
      { category: 'technical', test_type: 'academic', subject: 'DBMS',
        content: 'A DBMS manages structured data. Topics: relational model, SQL, normalization forms (1NF–BCNF), ACID transactions, indexes (B-tree, hash), joins (inner, outer, cross), query optimization, concurrency control, and recovery.' },
      { category: 'aptitude', test_type: 'company', subject: 'Time & Work',
        content: 'Time and Work problems: if A can do a job in x days and B in y days, together they finish in xy/(x+y) days. Include work-rate, pipes-and-cisterns, and man-days concepts.' },
      { category: 'verbal', test_type: 'company', subject: 'Synonyms & Antonyms',
        content: 'Verbal ability: synonyms, antonyms, reading comprehension, sentence correction, para-jumbles, and vocabulary (common GRE word roots).' },
    ];

    for (const t of topics) {
      await step(`Generate 3 questions: ${t.subject} (${t.category})`, async () => {
        const { status, json } = await api('POST', '/api/admin/question-bank/generate', {
          content: t.content,
          num_questions: 3,
          category: t.category,
          test_type: t.test_type,
          company_name: t.test_type === 'company' ? 'TCS' : null,
        });
        must(status < 300, `status=${status}: ${JSON.stringify(json).slice(0, 300)}`);
        must(json.success, json.error);
        must(json.data?.saved >= 1, `saved=${json.data?.saved}`);
        (json.data.questions || []).forEach((q) => created.questions.push(q));
        return json.data;
      });
    }
  }

  // 5. Course via AI generator, + manual course, + access scoping
  section('5. Courses (AI-generated + manual) & access control');
  let aiCourse = null;
  if (!SKIP_AI) {
    aiCourse = await step('Generate course "Intro to Java" via agent', async () => {
      const { status, json } = await api('POST', '/api/admin/courses/generate', {
        subject: `${PREFIX}Intro to Java`,
        difficulty: 'beginner',
        num_lessons: 4,
        audience: 'undergraduate CSE students',
        publish: true,
      });
      must(status < 300 && json.success, JSON.stringify(json).slice(0, 400));
      must(json.data?.course?.id, 'no course id');
      must((json.data.lessons || []).length >= 1, 'no lessons generated');
      return json.data;
    });
    if (aiCourse) {
      // Rename so cleanup picks it up.
      await api('PUT', `/api/admin/courses/${aiCourse.course.id}`, {
        ...aiCourse.course,
        title: `${PREFIX}${aiCourse.course.title}`,
      }).catch(() => {});
      created.courses.push(aiCourse.course);
      (aiCourse.lessons || []).forEach((l) => created.lessons.push(l));
    }
  }

  const manualCourse = await step('Create manual course', async () => {
    const { status, json } = await api('POST', '/api/admin/courses', {
      title: `${PREFIX}Manual DBMS Fundamentals`,
      description: 'Manually created course for E2E test',
      category: 'technical',
      difficulty: 'beginner',
      is_published: true,
    });
    must(status < 300 && json.success, JSON.stringify(json));
    return json.data;
  });
  if (manualCourse) created.courses.push(manualCourse);

  // 6. Lessons — add + edit
  section('6. Lessons — add & edit');
  if (manualCourse) {
    const lesson = await step('Add lesson to manual course', async () => {
      const { status, json } = await api('POST', '/api/admin/lessons', {
        course_id: manualCourse.id,
        title: `${PREFIX}Normalization`,
        description: 'Intro to 1NF, 2NF, 3NF, BCNF',
        content_text: 'Normalization reduces redundancy and dependency by splitting tables...',
        sort_order: 1,
        duration_minutes: 20,
      });
      must(status < 300 && json.success, JSON.stringify(json));
      return json.data;
    });
    if (lesson) {
      created.lessons.push(lesson);
      await step('Edit lesson title', async () => {
        const { status, json } = await api('PUT', `/api/admin/lessons/${lesson.id}`, {
          title: `${PREFIX}Normalization (Edited)`,
          duration_minutes: 25,
        });
        must(status < 300 && json.success, JSON.stringify(json));
        must((json.data.title || '').includes('Edited'), 'title not updated');
      });
    }
  }

  // 7. course_access: scope manual course to College1 / CSE / A
  section('7. Course access gating');
  if (manualCourse && created.sections[0]) {
    const s0 = created.sections[0];
    await step('Grant access: College1 CSE A', async () => {
      const { status, json } = await api('POST', `/api/admin/courses/${manualCourse.id}/access`, {
        college_id: s0.college_id,
        branch_id: s0.branch_id,
        section_id: s0.id,
      });
      must(status < 300 && json.success, JSON.stringify(json));
      created.access.push(json.data);
    });
    await step('List access entries', async () => {
      const { status, json } = await api('GET', `/api/admin/courses/${manualCourse.id}/access`);
      must(status < 300 && json.success, JSON.stringify(json));
      must((json.data || []).length >= 1, 'no access rows');
    });
  }

  // 8. Smoke checks
  section('8. Smoke checks');
  await step('GET /api/admin/overview', async () => {
    const { status, json } = await api('GET', '/api/admin/overview');
    must(status === 200 && json.success, JSON.stringify(json));
  });
  await step('GET /api/admin/students?limit=100', async () => {
    const { json } = await api('GET', '/api/admin/students?limit=100');
    must((json.data || []).length >= created.students.length, 'student count mismatch');
  });

  // ───────── summary ─────────
  section('Summary');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`Passed: ${color(32, passed)}   Failed: ${color(failed ? 31 : 32, failed)}   Total: ${results.length}`);
  console.log(`Created: colleges=${created.colleges.length} sections=${created.sections.length} ` +
              `students=${created.students.length} educators=${created.educators.length} ` +
              `courses=${created.courses.length} lessons=${created.lessons.length} ` +
              `questions=${created.questions.length}`);
  if (failed) {
    console.log('\nFailures:');
    results.filter((r) => !r.pass).forEach((r) => console.log('  - ' + r.name + ': ' + r.err));
  }
  console.log(`\nRun \`node scripts/admin-e2e-test.js --cleanup\` to remove TEST_ rows.`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(color(31, 'Fatal: ') + err.stack);
  process.exit(2);
});
