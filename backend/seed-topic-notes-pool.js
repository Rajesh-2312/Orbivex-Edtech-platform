/**
 * Parallel batch-seed for topic_notes pool.
 *
 * Generates all 5 pace variants for every topic in a (company, round) — or
 * across all rounds of a company — by hitting topicNotesAgent directly. Runs
 * up to CONCURRENCY generations in parallel (default 3, matching Ollama's
 * inflight cap from config/ollama.js).
 *
 * Examples:
 *   docker compose exec api node seed-topic-notes-pool.js tcs 0
 *   docker compose exec api node seed-topic-notes-pool.js tcs            # all rounds
 *   docker compose exec api node seed-topic-notes-pool.js tcs 0 --paces 1,3,5
 *   docker compose exec api node seed-topic-notes-pool.js tcs 0 --concurrency 2
 */

const { createClient } = require('@supabase/supabase-js');
const topicNotesAgent = require('./agents/topicNotesAgent');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      flags[key] = val;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function listTodoRows(slug, roundIndex, paces) {
  const query = supabase
    .from('company_rounds')
    .select('company_slug, company_name, round_index, title, summary, topics')
    .eq('company_slug', slug);
  if (roundIndex !== null) query.eq('round_index', roundIndex);

  const { data: rounds, error } = await query.order('round_index');
  if (error) throw new Error(error.message);
  if (!rounds || rounds.length === 0) {
    throw new Error(`No rounds for company "${slug}"${roundIndex !== null ? ` round ${roundIndex}` : ''}`);
  }

  // Pull existing notes once per round so we can skip already-seeded variants.
  const tasks = [];
  for (const round of rounds) {
    const topics = Array.isArray(round.topics) ? round.topics : [];
    const { data: existing } = await supabase
      .from('topic_notes')
      .select('topic, pace_level')
      .eq('company_slug', round.company_slug)
      .eq('round_index', round.round_index);
    const seeded = new Set((existing || []).map((r) => `${r.topic}::${r.pace_level}`));

    for (const topic of topics) {
      for (const pace of paces) {
        if (seeded.has(`${topic}::${pace}`)) continue;
        tasks.push({
          slug: round.company_slug,
          companyName: round.company_name,
          roundIndex: round.round_index,
          roundTitle: round.title,
          topic,
          pace,
        });
      }
    }
  }

  return tasks;
}

async function seedOne(task) {
  const t0 = Date.now();
  const notes = await topicNotesAgent.generate({
    topic: task.topic,
    company: task.companyName,
    roundTitle: task.roundTitle,
    paceLevel: task.pace,
  });
  const { error } = await supabase
    .from('topic_notes')
    .upsert({
      company_slug: task.slug,
      round_index: task.roundIndex,
      topic: task.topic,
      pace_level: task.pace,
      notes_json: notes,
      model: topicNotesAgent.model,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_slug,round_index,topic,pace_level' });
  if (error) throw new Error(`DB write: ${error.message}`);
  return Date.now() - t0;
}

/** Bounded-parallel runner — keeps `concurrency` tasks in flight at once. */
async function runPool(tasks, concurrency, onResult) {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < tasks.length) {
      const i = cursor++;
      const task = tasks[i];
      try {
        const ms = await seedOne(task);
        onResult({ task, ok: true, ms });
      } catch (err) {
        onResult({ task, ok: false, error: err.message });
      }
    }
  });
  await Promise.all(workers);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv);
  const slug = positional[0];
  const roundArg = positional[1];

  if (!slug) {
    console.error('Usage: node seed-topic-notes-pool.js <company-slug> [round-index] [--paces 1,2,3,4,5] [--concurrency 3]');
    process.exit(1);
  }

  const roundIndex = roundArg !== undefined ? Number(roundArg) : null;
  const paces = (flags.paces ? String(flags.paces).split(',') : ['1', '2', '3', '4', '5'])
    .map((s) => Number(s.trim()))
    .filter((n) => n >= 1 && n <= 5);
  const concurrency = Math.max(1, Math.min(5, Number(flags.concurrency) || 3));

  console.log(`\nSeeding topic_notes pool for "${slug}"${roundIndex !== null ? ` round ${roundIndex}` : ' (all rounds)'}`);
  console.log(`  Paces: ${paces.join(', ')}`);
  console.log(`  Concurrency: ${concurrency}\n`);

  const tasks = await listTodoRows(slug, roundIndex, paces);
  if (tasks.length === 0) {
    console.log('Nothing to do — every requested (topic, pace) is already in the pool.\n');
    return;
  }

  console.log(`Tasks to run: ${tasks.length}\n`);

  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  await runPool(tasks, concurrency, ({ task, ok, ms, error }) => {
    done += 1;
    const tag = ok ? `[ok ${ms}ms]` : `[FAIL] ${error}`;
    console.log(`  ${String(done).padStart(3)}/${tasks.length} ${tag}  ${task.slug} r${task.roundIndex} · "${task.topic}" · pace ${task.pace}`);
    if (!ok) failed += 1;
  });

  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone. ${done - failed}/${tasks.length} succeeded in ${totalSec}s.${failed ? ` ${failed} failures.` : ''}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
