/**
 * Apply supabase-setup.sql + scripts/migrations/*.sql to a Supabase project.
 *
 * Uses the Supabase Management API (the only way to run raw DDL without psql).
 * Requires a personal access token — NOT the service_role key:
 *   https://supabase.com/dashboard/account/tokens  ->  sbp_...
 *
 * Run:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/run-migrations.js          # apply
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/run-migrations.js --dry    # list only
 *
 * Project ref is read from SUPABASE_URL in .env, or override with --ref=<ref>.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Load .env from the repo root. dotenv lives in backend/node_modules, not here,
// so fall back to a minimal parser rather than depending on a root install.
try {
  require('dotenv').config({ path: path.join(ROOT, '.env') });
} catch {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const DRY = process.argv.includes('--dry');
const refArg = process.argv.find(a => a.startsWith('--ref='));

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = refArg
  ? refArg.split('=')[1]
  : (process.env.SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

// Only drops tables a fresh project never created; see the file header.
const SKIP = new Set(['2026_07_10_remove_saas_billing.sql']);

function plan() {
  const migDir = path.join(ROOT, 'scripts', 'migrations');
  const migrations = fs
    .readdirSync(migDir)
    .filter(f => f.endsWith('.sql') && !SKIP.has(f))
    .sort() // filenames are date-prefixed, so lexical order == chronological
    .map(f => path.join(migDir, f));
  return [path.join(ROOT, 'supabase-setup.sql'), ...migrations];
}

async function exec(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 600)}`);
  return text;
}

async function main() {
  const files = plan();

  if (!REF) {
    console.error('Could not determine project ref. Set SUPABASE_URL in .env or pass --ref=<ref>.');
    process.exit(1);
  }

  console.log(`Project: ${REF}`);
  console.log(`Files:   ${files.length} (skipping ${[...SKIP].join(', ')})\n`);

  if (DRY) {
    files.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)}. ${path.basename(f)}`));
    console.log('\nDry run — nothing applied.');
    return;
  }

  if (!TOKEN) {
    console.error('SUPABASE_ACCESS_TOKEN is not set. Get one at');
    console.error('https://supabase.com/dashboard/account/tokens (starts with sbp_).');
    process.exit(1);
  }

  // pgvector is needed by 2026_06_11_rag_and_realtime.sql.
  await exec('create extension if not exists vector;');
  console.log('  ok  extension vector\n');

  for (const file of files) {
    const name = path.basename(file);
    process.stdout.write(`  ... ${name}`);
    try {
      await exec(fs.readFileSync(file, 'utf8'));
      process.stdout.write(`\r  ok  ${name}\n`);
    } catch (err) {
      process.stdout.write(`\r  FAIL ${name}\n\n${err.message}\n`);
      console.error('\nStopped. Fix the above, then re-run — the SQL is idempotent.');
      process.exit(1);
    }
  }

  console.log('\nAll migrations applied.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
