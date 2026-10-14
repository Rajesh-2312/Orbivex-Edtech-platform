#!/usr/bin/env node
/**
 * Orbivex RAG evaluation harness.
 *
 * Answers the question every retrieval change raises: did that actually help?
 * Without it, "hybrid search" and "reranking" are vibes, and the Phase 6
 * fine-tune has no promotion criterion.
 *
 * Seeds a golden corpus into content_embeddings (tagged so it can be removed),
 * runs a fixed question set through the real utils/rag.js path, and reports:
 *
 *   recall@k    — was the correct chunk retrieved at all
 *   MRR         — how high it ranked
 *   abstention  — did we correctly refuse questions the corpus cannot answer
 *   latency     — p50 / p95 per query
 *
 * Usage:
 *   node scripts/rag-eval.js                  # shipping config (hybrid, no rerank)
 *   node scripts/rag-eval.js --rerank         # ablation: add the reranker
 *   node scripts/rag-eval.js --no-hybrid      # ablation: vector only
 *   node scripts/rag-eval.js --baseline       # vector only, no rerank
 *   node scripts/rag-eval.js --cleanup        # remove seeded rows and exit
 *
 * Measured 2026-07-23 (NIM embeddings), golden corpus + 56 real seeded chunks:
 *
 *   config              recall@5   MRR     p50      p95
 *   baseline            100%       1.000   579ms    1328ms
 *   hybrid (shipping)   100%       1.000   525ms     747ms
 *   hybrid + rerank     100%       0.950   3034ms  12003ms
 *
 * Conclusions:
 *   - Hybrid is free (no latency cost), so it stays on.
 *   - Reranking is a net negative — it demotes a correct chunk and costs ~6x
 *     latency — reproduced on two independent corpora. Off by default.
 *
 * KNOWN LIMITATION: recall is saturated because the golden questions are all
 * DBMS while the seeded lessons are C/Python/Aptitude/Verbal — the distractors
 * are off-topic and never compete. This harness currently proves "retrieval is
 * not broken", NOT "strategy A beats strategy B". To make it discriminate, add
 * golden questions and near-duplicate distractors within the SAME topic as the
 * seeded content. Until then, treat A/B deltas here as lower bounds.
 *
 * Requires SUPABASE_SERVICE_KEY (writes to content_embeddings) and
 * NVIDIA_API_KEY (embeddings).
 */

const path = require('path');
const fs = require('fs');

// Load .env from the repo root; dotenv lives in backend/, not here.
const ROOT = path.join(__dirname, '..');
try {
  require('dotenv').config({ path: path.join(ROOT, '.env') });
} catch {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const { supabaseAdmin } = require(path.join(ROOT, 'backend/config/supabase'));
const { retrieveContext, topRelevance } = require(path.join(ROOT, 'backend/utils/rag'));
const { MIN_RELEVANCE } = require(path.join(ROOT, 'backend/agents/tutorAgent'));
const tutorAgent = require(path.join(ROOT, 'backend/agents/tutorAgent'));
const { verifyCitations, scoreGroundedness } = require(path.join(ROOT, 'backend/agents/verifier'));
const { buildContextBlock } = require(path.join(ROOT, 'backend/utils/rag'));
const { embedBatch } = require(path.join(ROOT, 'backend/agents/embed'));
const { chunkDocument, buildEmbedText } = require(path.join(ROOT, 'backend/utils/chunker'));

const EVAL_TAG = 'rag-eval-golden';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);

// Defaults mirror what retrieveContext actually ships with, so a bare run
// measures production behaviour. Reranking is opt-in because it measured as a
// net negative here — see the header notes on --rerank.
const OPTIONS = {
  hybrid: !has('--no-hybrid') && !has('--baseline'),
  rerank: has('--rerank') && !has('--baseline'),
  match_count: 5,
};

// ── Golden corpus ────────────────────────────────────────────────────────────
// Written as real lesson documents so the chunker is exercised too, not bypassed.
const LESSONS = [
  {
    title: 'Database Indexing',
    body: `# Database Indexing

## B-Tree Indexes
A B-tree keeps keys in sorted order. Lookups cost O(log n) because the height of the tree grows logarithmically with the number of keys. Because keys are sorted, a B-tree also serves range scans and ORDER BY without a separate sort step.

## Write Amplification
Every INSERT and UPDATE must also maintain the index pages. Adding five indexes to a write-heavy table measurably slows writes, so index deliberately rather than defensively.

## Hash Indexes
A hash index hashes the key and jumps straight to the bucket, giving O(1) average lookups. Hashing destroys ordering, so hash indexes cannot serve range queries or ORDER BY at all.

## Covering Indexes
A covering index contains every column the query needs, so the database answers from the index alone and never touches the heap.`,
  },
  {
    title: 'Transactions and Concurrency',
    body: `# Transactions and Concurrency

## ACID Properties
Atomicity means all statements in a transaction succeed or none do. Consistency means the database moves between valid states. Isolation means concurrent transactions do not observe each other's partial work. Durability means a committed transaction survives a crash.

## Deadlocks
A deadlock occurs when two transactions each hold a lock the other needs. The database detects the cycle and aborts one transaction, which the application must retry.

## Isolation Levels
Read Committed prevents dirty reads. Repeatable Read additionally prevents non-repeatable reads. Serializable prevents phantom reads and is the strictest level.`,
  },
  {
    title: 'Normalization',
    body: `# Normalization

## First and Second Normal Form
First normal form requires every column to hold a single atomic value. Second normal form additionally requires every non-key column to depend on the whole primary key, not just part of it.

## Third Normal Form
Third normal form removes transitive dependencies: a non-key column must not depend on another non-key column. This is the level most production schemas target.

## Denormalization
Denormalization deliberately reintroduces redundancy to avoid expensive joins on read-heavy workloads, trading write complexity for read speed.`,
  },
];

// question → the phrase that must appear in the correct chunk
const ANSWERABLE = [
  ['what is the time complexity of a b-tree lookup?', 'logarithmically'],
  ['why do my inserts get slower when I add more indexes?', 'index pages'],
  ['can I use a hash index for an ORDER BY?', 'destroys ordering'],
  ['how can a query be answered without reading the table?', 'covering index'],
  ['what does durability mean in ACID?', 'survives a crash'],
  ['two transactions are stuck waiting on each other, what happens?', 'aborts one transaction'],
  ['which isolation level stops phantom reads?', 'Serializable'],
  ['what does second normal form require?', 'whole primary key'],
  ['when would I deliberately add redundancy back into a schema?', 'Denormalization'],
  ['what makes a column violate first normal form?', 'atomic value'],
];

// Real questions whose answers ARE in the seeded lessons (seed-lessons.js).
// These must not abstain — they guard against the false-abstention regression
// where a miscalibrated threshold refuses answerable questions.
const SEEDED_ANSWERABLE = [
  ['what is the difference between malloc and calloc', 'Pointers and Memory Management'],
  ['what is a for loop', 'Operators and Control Flow'],
  ['how do I define a function in python', 'Functions and Modules'],
  ['what is a list comprehension', 'List Comprehensions and Advanced Data Structures'],
  ['how to calculate compound interest', 'Percentages, Profit & Loss'],
  ['what is subject verb agreement', 'Subject-Verb Agreement and Common Errors'],
];

// Questions the corpus genuinely cannot answer — the assistant must abstain.
const UNANSWERABLE = [
  'what is the syllabus for the TCS NQT aptitude round?',
  'how do I install PostgreSQL on Windows?',
  'who is the head of the computer science department?',
  'what is the capital of Australia?',
  'how much does a Supabase Pro plan cost?',
];

// ── Seeding ──────────────────────────────────────────────────────────────────
async function cleanup() {
  const { error } = await supabaseAdmin
    .from('content_embeddings')
    .delete()
    .eq('metadata->>eval', EVAL_TAG);
  if (error) throw error;
}

async function seed() {
  const { count } = await supabaseAdmin
    .from('content_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('metadata->>eval', EVAL_TAG);

  if (count > 0) {
    console.log(`golden corpus already seeded (${count} chunks)\n`);
    return;
  }

  console.log('seeding golden corpus...');
  const rows = [];

  for (const lesson of LESSONS) {
    const sourceId = randomUUID();
    const chunks = chunkDocument(lesson.body);
    const vectors = await embedBatch(
      chunks.map((c) => buildEmbedText(c, [lesson.title])),
      { inputType: 'passage' },
    );
    chunks.forEach((c, i) => {
      rows.push({
        source_type: 'lesson',
        source_id: sourceId,
        chunk_index: i,
        content_chunk: c.text,
        embedding: vectors[i],
        metadata: {
          eval: EVAL_TAG,
          lesson_title: lesson.title,
          heading_path: c.headingPath,
          token_count: c.tokenCount,
        },
      });
    });
  }

  const { error } = await supabaseAdmin.from('content_embeddings').insert(rows);
  if (error) throw error;
  console.log(`seeded ${rows.length} chunks from ${LESSONS.length} lessons\n`);
}

function randomUUID() {
  return require('crypto').randomUUID();
}

// ── Metrics ──────────────────────────────────────────────────────────────────
function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function run() {
  const latencies = [];
  let hits = 0;
  let reciprocalRankSum = 0;
  const misses = [];

  console.log(`config: hybrid=${OPTIONS.hybrid} rerank=${OPTIONS.rerank} k=${OPTIONS.match_count}\n`);
  console.log('── answerable ────────────────────────────────────────────');

  for (const [question, needle] of ANSWERABLE) {
    const t0 = Date.now();
    const chunks = await retrieveContext(question, OPTIONS);
    latencies.push(Date.now() - t0);

    const rank = chunks.findIndex((c) => (c.content_chunk || '').includes(needle)) + 1;
    if (rank > 0) {
      hits++;
      reciprocalRankSum += 1 / rank;
      console.log(`  ok   rank ${rank}  ${question}`);
    } else {
      misses.push(question);
      console.log(`  MISS       ${question}`);
    }
  }

  console.log('\n── unanswerable (must abstain) ───────────────────────────');
  let correctAbstentions = 0;
  for (const question of UNANSWERABLE) {
    const t0 = Date.now();
    const chunks = await retrieveContext(question, OPTIONS);
    latencies.push(Date.now() - t0);

    const relevance = topRelevance(chunks);
    const abstained = chunks.length === 0 || relevance < MIN_RELEVANCE;
    if (abstained) correctAbstentions++;
    console.log(`  ${abstained ? 'ok  ' : 'LEAK'}  top=${relevance.toFixed(2)}  ${question}`);
  }

  // Real questions against real seeded lessons that must NOT abstain — regression
  // guard for the false-abstention bug (nv-embedqa compresses cosine scores, so
  // a too-high MIN_RELEVANCE silently refuses answerable questions).
  console.log('\n── answerable against seeded lessons (must NOT abstain) ───');
  let falseAbstentions = 0;
  for (const [question, lessonTitle] of SEEDED_ANSWERABLE) {
    const { data: lesson } = await supabaseAdmin
      .from('lessons').select('id').eq('title', lessonTitle).maybeSingle();
    if (!lesson) { console.log(`  skip (not seeded)  ${lessonTitle}`); continue; }

    const chunks = await retrieveContext(question, { ...OPTIONS, source_type: 'lesson', source_id: lesson.id });
    const relevance = topRelevance(chunks);
    const abstained = chunks.length === 0 || relevance < MIN_RELEVANCE;
    if (abstained) falseAbstentions++;
    console.log(`  ${abstained ? 'FALSE-ABSTAIN' : 'ok  '}  top=${relevance.toFixed(2)}  ${question}`);
  }

  const n = ANSWERABLE.length;
  console.log('\n── results ───────────────────────────────────────────────');
  console.log(`  recall@${OPTIONS.match_count}        ${((hits / n) * 100).toFixed(0)}%  (${hits}/${n})`);
  console.log(`  MRR              ${(reciprocalRankSum / n).toFixed(3)}`);
  console.log(`  abstention       ${((correctAbstentions / UNANSWERABLE.length) * 100).toFixed(0)}%  (${correctAbstentions}/${UNANSWERABLE.length})`);
  console.log(`  false-abstain    ${falseAbstentions}  (must be 0)`);
  console.log(`  latency p50      ${percentile(latencies, 50)}ms`);
  console.log(`  latency p95      ${percentile(latencies, 95)}ms`);
  if (misses.length) {
    console.log('\n  missed:');
    misses.forEach((m) => console.log(`    - ${m}`));
  }
}

/**
 * Answer-quality pass (opt-in via --answers): generates real tutor answers for
 * the seeded questions and measures the Phase 4 controls — citation validity
 * (fabricated [n] must be 0) and groundedness (LLM judge, 0..1). Slow, one LLM
 * call per question plus a judge call, so it is not part of the default run.
 */
async function runAnswers() {
  console.log('\n── answer quality (real generations) ─────────────────────');
  let fabricated = 0;
  let groundedSum = 0;
  let scored = 0;

  for (const [question, lessonTitle] of SEEDED_ANSWERABLE) {
    const { data: lesson } = await supabaseAdmin
      .from('lessons').select('id').eq('title', lessonTitle).maybeSingle();
    if (!lesson) { console.log(`  skip (not seeded)  ${lessonTitle}`); continue; }

    const { answer, citations, abstained } = await tutorAgent.answer({
      lessonId: lesson.id, message: question, history: [],
    });
    if (abstained) { console.log(`  ABSTAINED  ${question}`); continue; }

    const { invalidCitations } = verifyCitations(answer, citations.length);
    fabricated += invalidCitations;

    const sourcesBlock = citations.map((c) => `[${c.n}] (${c.lesson_title || 'lesson'}) ${c.preview}`).join('\n\n');
    const g = await scoreGroundedness(answer, sourcesBlock);
    if (g !== null) { groundedSum += g; scored++; }

    console.log(`  grounded=${g === null ? 'n/a' : g.toFixed(2)}  fabricated=${invalidCitations}  ${question}`);
  }

  console.log('\n  fabricated citations (total, must be 0):', fabricated);
  console.log('  mean groundedness:', scored ? (groundedSum / scored).toFixed(2) : 'n/a');
}

(async () => {
  if (has('--cleanup')) {
    await cleanup();
    console.log('removed seeded eval rows');
    return;
  }
  await seed();
  try {
    await run();
    if (has('--answers')) await runAnswers();
  } finally {
    // Always remove the golden corpus afterwards so it never contaminates real
    // cross-lesson search (its synthetic lessons share the content_embeddings
    // table with production data). Pass --keep to leave it for fast re-runs.
    if (!has('--keep')) {
      await cleanup();
      console.log('\n(cleaned up golden corpus; pass --keep to retain for faster re-runs)');
    }
  }
})().catch((err) => {
  console.error('\neval failed:', err.message);
  process.exit(1);
});
