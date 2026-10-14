/**
 * Self-healing helpers for retrieval.
 *
 * When a lesson has content_text but zero embedded chunks, the tutor otherwise
 * hits a permanent dead end — it says "not indexed yet" forever and nothing
 * ever fixes it. This detects that specific case and reindexes the lesson in
 * the background, so the next question works.
 *
 * Reindex requests are de-duplicated: if the same lesson misses several times
 * in quick succession (a class opening the same lesson at once), only one
 * reindex runs.
 */

const { supabaseAdmin } = require('../config/supabase');
const { reindexLesson } = require('./embedLesson');

const inFlight = new Map(); // lessonId → Promise

/**
 * Decide what an empty retrieval on a lesson means, and self-heal if it is an
 * indexing gap. Returns:
 *   { indexed: true }               — lesson has chunks; the miss was off-topic
 *   { indexed: false, healing:true} — lesson has content but no chunks; reindex started
 *   { indexed: false, healing:false}— lesson has no content to index
 *
 * The caller uses `indexed` to pick the right message: an off-topic question on
 * an indexed lesson must NOT be told "not indexed — ask your educator".
 *
 * Never throws — a self-heal failure must not break the caller's turn.
 */
async function healLessonIndex(lessonId) {
  if (!lessonId) return { indexed: false, healing: false };
  if (inFlight.has(lessonId)) return { indexed: false, healing: true };

  try {
    const { count } = await supabaseAdmin
      .from('content_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('source_type', 'lesson')
      .eq('source_id', lessonId);
    if (count > 0) return { indexed: true, healing: false }; // real no-match, not an indexing gap

    const { data: lesson } = await supabaseAdmin
      .from('lessons').select('id, content_text').eq('id', lessonId).maybeSingle();
    if (!lesson?.content_text?.trim()) return { indexed: false, healing: false }; // nothing to index

    const p = reindexLesson(lessonId)
      .then((r) => console.log(`[selfHeal] reindexed lesson ${lessonId}: ${r.chunks ?? 0} chunks`))
      .catch((err) => console.warn(`[selfHeal] reindex failed for ${lessonId}: ${err.message}`))
      .finally(() => inFlight.delete(lessonId));
    inFlight.set(lessonId, p);
    return { indexed: false, healing: true };
  } catch (err) {
    console.warn(`[selfHeal] check failed for ${lessonId}: ${err.message}`);
    return { indexed: false, healing: false };
  }
}

module.exports = { healLessonIndex };
