-- ───────────────────────────────────────────────────────────
-- Phase 10 — Engaged Learning
-- AI tutor (pgvector RAG), notifications wiring, calendar
-- Date: 2026-05-18
-- ───────────────────────────────────────────────────────────

-- ═══ F1: pgvector + tutor RAG ════════════════════════════════
CREATE EXTENSION IF NOT EXISTS vector;

-- One row per ~500-char chunk of a lesson's content_text.
-- 768-d native output of nomic-embed-text.
CREATE TABLE IF NOT EXISTS public.lesson_embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  content_chunk TEXT NOT NULL,
  embedding     vector(768) NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lesson_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_lesson_embeddings_lesson
  ON public.lesson_embeddings(lesson_id);
-- IVFFlat ANN index. lists=100 is fine up to ~100k chunks; rebuild with
-- REINDEX INDEX idx_lesson_embeddings_ann after bulk seeding.
CREATE INDEX IF NOT EXISTS idx_lesson_embeddings_ann
  ON public.lesson_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ALTER TABLE public.lesson_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lesson_embeddings readable by authenticated" ON public.lesson_embeddings;
CREATE POLICY "lesson_embeddings readable by authenticated"
  ON public.lesson_embeddings FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.tutor_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id  UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content    TEXT NOT NULL,
  citations  JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tutor_messages_user_lesson_time
  ON public.tutor_messages(user_id, lesson_id, created_at);
ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own tutor messages" ON public.tutor_messages;
CREATE POLICY "own tutor messages"
  ON public.tutor_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ANN RPC: top-k chunks within a single lesson.
CREATE OR REPLACE FUNCTION public.match_lesson_chunks(
  query_embedding vector(768),
  match_lesson_id UUID,
  match_count INT DEFAULT 5
) RETURNS TABLE (
  lesson_id    UUID,
  chunk_index  INT,
  content_chunk TEXT,
  similarity   FLOAT,
  lesson_title TEXT
) LANGUAGE SQL STABLE AS $$
  SELECT le.lesson_id,
         le.chunk_index,
         le.content_chunk,
         1 - (le.embedding <=> query_embedding) AS similarity,
         l.title AS lesson_title
  FROM public.lesson_embeddings le
  JOIN public.lessons l ON l.id = le.lesson_id
  WHERE le.lesson_id = match_lesson_id
  ORDER BY le.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ANN RPC: similar courses (averaged similarity across their lesson chunks).
CREATE OR REPLACE FUNCTION public.match_course_chunks(
  query_embedding vector(768),
  exclude_course_id UUID DEFAULT NULL,
  match_count INT DEFAULT 5
) RETURNS TABLE (
  course_id    UUID,
  course_title TEXT,
  similarity   FLOAT
) LANGUAGE SQL STABLE AS $$
  SELECT l.course_id,
         c.title AS course_title,
         AVG(1 - (le.embedding <=> query_embedding)) AS similarity
  FROM public.lesson_embeddings le
  JOIN public.lessons l ON l.id = le.lesson_id
  JOIN public.courses c ON c.id = l.course_id
  WHERE (exclude_course_id IS NULL OR l.course_id <> exclude_course_id)
  GROUP BY l.course_id, c.title
  ORDER BY similarity DESC
  LIMIT match_count;
$$;


-- ═══ F2: notifications widening + email opt-in ═══════════════
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type         TEXT,
  ADD COLUMN IF NOT EXISTS entity_type  TEXT,
  ADD COLUMN IF NOT EXISTS entity_id    UUID,
  ADD COLUMN IF NOT EXISTS action_url   TEXT;

-- Open list of valid notification types (easier to widen than enum).
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD  CONSTRAINT notifications_type_check
  CHECK (type IS NULL OR type IN (
    'grade','assignment','course_access','test_published',
    'application_status','tutor_reply','calendar_event','course_complete'
  ));

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_time
  ON public.notifications(user_id, read, created_at DESC);

-- Per-user email opt-in. Default ON; surfaced in Settings UI.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_email_optin BOOLEAN DEFAULT TRUE;

-- Enable Supabase Realtime broadcasts on the table so the frontend
-- channel `notifications:user_id=eq.<id>` fires on INSERT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;


-- ═══ F3: calendar_events ═════════════════════════════════════
-- Wildcards: any of (user_id, college_id, branch_id, section_id) may be NULL.
-- A row matches a student when each non-NULL column equals the student's profile.
-- All-NULL rows are platform-wide.
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id         UUID REFERENCES public.colleges(id) ON DELETE CASCADE,
  branch_id          UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  section_id         UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  course_id          UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  test_paper_id      UUID REFERENCES public.test_papers(id) ON DELETE CASCADE,
  company_round_id   UUID,
  title              TEXT NOT NULL,
  description        TEXT,
  type               TEXT NOT NULL CHECK (type IN ('exam','deadline','class','event')),
  starts_at          TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ,
  all_day            BOOLEAN DEFAULT FALSE,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at ON public.calendar_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user      ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_section   ON public.calendar_events(section_id);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_events readable by authenticated" ON public.calendar_events;
CREATE POLICY "calendar_events readable by authenticated"
  ON public.calendar_events FOR SELECT TO authenticated USING (true);
