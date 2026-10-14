/**
 * embedLesson — backward-compatible wrapper over rag.js
 * Existing callers use reindexLesson(lessonId); this now writes to
 * the unified content_embeddings table instead of lesson_embeddings.
 */

const { supabaseAdmin } = require('../config/supabase');
const { indexLesson } = require('./rag');

async function reindexLesson(lessonId) {
  if (!lessonId) return { skipped: true, reason: 'no_lesson_id' };

  // courses(title) feeds the chunk's heading prefix, so a chunk embedded from
  // "Indexing" also carries the course it belongs to.
  const { data: lesson, error } = await supabaseAdmin
    .from('lessons')
    .select('id, title, content_text, course_id, courses(title)')
    .eq('id', lessonId)
    .single();

  if (error || !lesson) return { skipped: true, reason: 'lesson_not_found' };
  if (!lesson.content_text?.trim()) return { skipped: true, reason: 'empty_content', chunks: 0 };

  const { indexed } = await indexLesson({
    ...lesson,
    course_title: lesson.courses?.title || '',
  });
  return { skipped: false, chunks: indexed };
}

module.exports = { reindexLesson };
