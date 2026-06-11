-- ============================================================
-- Migration: RAG content_embeddings + Realtime support
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. Central content embeddings table
--    Stores embedded chunks from: lessons, question_bank
-- ============================================================
CREATE TABLE IF NOT EXISTS content_embeddings (
  id            BIGSERIAL PRIMARY KEY,
  source_type   TEXT        NOT NULL,           -- 'lesson' | 'question'
  source_id     UUID        NOT NULL,           -- FK to lessons.id / question_bank.id
  course_id     UUID        REFERENCES courses(id) ON DELETE CASCADE,
  chunk_index   INT         NOT NULL DEFAULT 0,
  content_chunk TEXT        NOT NULL,
  embedding     VECTOR(1024),                   -- NIM dim; use VECTOR(768) if Ollama-only
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id, chunk_index)
);

-- HNSW index — fast approximate nearest-neighbour search
CREATE INDEX IF NOT EXISTS content_embeddings_hnsw
  ON content_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- B-tree index for filtered queries
CREATE INDEX IF NOT EXISTS content_embeddings_source
  ON content_embeddings (source_type, source_id);

CREATE INDEX IF NOT EXISTS content_embeddings_course
  ON content_embeddings (course_id)
  WHERE course_id IS NOT NULL;

-- ============================================================
-- 3. match_content RPC — called by backend/utils/rag.js
-- ============================================================
CREATE OR REPLACE FUNCTION match_content(
  query_embedding VECTOR(1024),
  p_source_type   TEXT    DEFAULT NULL,
  p_source_id     UUID    DEFAULT NULL,
  p_course_id     UUID    DEFAULT NULL,
  p_match_count   INT     DEFAULT 5,
  p_threshold     FLOAT   DEFAULT 0.3
)
RETURNS TABLE (
  id            BIGINT,
  source_type   TEXT,
  source_id     UUID,
  course_id     UUID,
  chunk_index   INT,
  content_chunk TEXT,
  metadata      JSONB,
  similarity    FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ce.id,
    ce.source_type,
    ce.source_id,
    ce.course_id,
    ce.chunk_index,
    ce.content_chunk,
    ce.metadata,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM content_embeddings ce
  WHERE
    (p_source_type IS NULL OR ce.source_type = p_source_type)
    AND (p_source_id   IS NULL OR ce.source_id   = p_source_id)
    AND (p_course_id   IS NULL OR ce.course_id   = p_course_id)
    AND 1 - (ce.embedding <=> query_embedding) >= p_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT p_match_count;
$$;

-- ============================================================
-- 4. Backward-compat alias for tutorAgent.js (match_lesson_chunks)
-- ============================================================
CREATE OR REPLACE FUNCTION match_lesson_chunks(
  query_embedding VECTOR(1024),
  match_lesson_id UUID,
  match_count     INT DEFAULT 5
)
RETURNS TABLE (
  lesson_id     UUID,
  lesson_title  TEXT,
  chunk_index   INT,
  content_chunk TEXT,
  similarity    FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ce.source_id                       AS lesson_id,
    ce.metadata->>'lesson_title'       AS lesson_title,
    ce.chunk_index,
    ce.content_chunk,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM content_embeddings ce
  WHERE
    ce.source_type = 'lesson'
    AND ce.source_id = match_lesson_id
    AND 1 - (ce.embedding <=> query_embedding) >= 0.2
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- 5. Realtime: enable publication on core tables
--    (Supabase Realtime subscribes via postgres_changes)
-- ============================================================
ALTER PUBLICATION supabase_realtime
  ADD TABLE notifications;

ALTER PUBLICATION supabase_realtime
  ADD TABLE progress;

ALTER PUBLICATION supabase_realtime
  ADD TABLE test_submissions;

ALTER PUBLICATION supabase_realtime
  ADD TABLE placement_drives;

-- ============================================================
-- 6. RLS for content_embeddings
--    Backend uses service-role key (bypasses RLS).
--    Anon/student clients never need to read this table directly.
-- ============================================================
ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;

-- Service role bypasses automatically; deny all other access
CREATE POLICY "no_direct_access" ON content_embeddings
  FOR ALL USING (FALSE);
