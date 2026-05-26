#!/usr/bin/env node
/**
 * Backfill lesson embeddings for the AI tutor.
 *
 *   docker compose exec api node scripts/backfill-embeddings.js
 *   docker compose exec api node scripts/backfill-embeddings.js --course=<uuid>
 *   docker compose exec api node scripts/backfill-embeddings.js --lesson=<uuid>
 *   docker compose exec api node scripts/backfill-embeddings.js --limit=20
 *
 * Idempotent: each lesson's existing rows are replaced.
 */

// Env is injected by Docker Compose when run inside orbivex-api. If invoked
// from the host directly, load .env manually (dotenv is optional).
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); }
catch { /* dotenv not installed — container case */ }

const fs = require('fs');
const path = require('path');

// Two possible layouts:
//   - host:      <repo>/scripts/backfill-embeddings.js  →  <repo>/backend/
//   - container: /app/backfill-embeddings.js            →  /app/  (already backend/)
const candidates = [
  path.join(__dirname, '..', 'backend'),
  __dirname,
];
const backend = candidates.find((p) => fs.existsSync(path.join(p, 'config', 'supabase.js')));
if (!backend) {
  console.error('Cannot locate backend/ modules. Tried:', candidates);
  process.exit(1);
}

const { supabaseAdmin } = require(path.join(backend, 'config', 'supabase'));
const { reindexLesson } = require(path.join(backend, 'utils', 'embedLesson'));

function arg(name) {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split('=')[1] : null;
}

(async () => {
  const courseId = arg('course');
  const lessonId = arg('lesson');
  const limit = parseInt(arg('limit') || '0', 10);

  let q = supabaseAdmin.from('lessons').select('id, title, course_id, content_text');
  if (lessonId) q = q.eq('id', lessonId);
  if (courseId) q = q.eq('course_id', courseId);

  const { data: lessons, error } = await q;
  if (error) { console.error('Failed to list lessons:', error.message); process.exit(1); }

  const eligible = (lessons || []).filter((l) => l.content_text && l.content_text.trim());
  const work = limit > 0 ? eligible.slice(0, limit) : eligible;

  if (!work.length) {
    console.log('No lessons with non-empty content_text. Nothing to do.');
    process.exit(0);
  }

  console.log(`Backfilling embeddings for ${work.length} lesson(s)…`);
  let ok = 0, skipped = 0, failed = 0;

  for (let i = 0; i < work.length; i++) {
    const l = work[i];
    const tag = `[${i + 1}/${work.length}] ${l.title} (${l.id.slice(0, 8)})`;
    try {
      const result = await reindexLesson(l.id);
      if (result?.skipped) {
        skipped++;
        console.log(`${tag} — SKIPPED (${result.reason})`);
      } else {
        ok++;
        console.log(`${tag} — OK (${result.chunks} chunks)`);
      }
    } catch (err) {
      failed++;
      console.warn(`${tag} — FAILED: ${err?.message || err}`);
    }
  }

  console.log(`\nDone. ok=${ok} skipped=${skipped} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
