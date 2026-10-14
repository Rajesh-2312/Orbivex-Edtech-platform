-- ============================================================
--  Orbivex — Placement Tools Migration
--  2026-06-07
--  Tables: resumes, skill_gap_results, pyq_bookmarks
--  Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. resumes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resumes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text DEFAULT 'My Resume',
  resume_json jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resumes_student ON public.resumes(student_id);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resumes_own" ON public.resumes;
CREATE POLICY "resumes_own"
  ON public.resumes FOR ALL
  USING  (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ── 2. skill_gap_results ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_gap_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score         int NOT NULL DEFAULT 0,
  weak_topics   text[] DEFAULT '{}',
  strong_topics text[] DEFAULT '{}',
  study_plan    jsonb DEFAULT '{}',
  updated_at    timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_gap_student ON public.skill_gap_results(student_id);

ALTER TABLE public.skill_gap_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skill_gap_own" ON public.skill_gap_results;
CREATE POLICY "skill_gap_own"
  ON public.skill_gap_results FOR ALL
  USING  (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ── 3. pyq_bookmarks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pyq_bookmarks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_hash  text NOT NULL,
  subject        text,
  question       text,
  university     text,
  year           int,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(student_id, question_hash)
);

CREATE INDEX IF NOT EXISTS idx_pyq_bookmarks_student ON public.pyq_bookmarks(student_id);

ALTER TABLE public.pyq_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pyq_bookmarks_own" ON public.pyq_bookmarks;
CREATE POLICY "pyq_bookmarks_own"
  ON public.pyq_bookmarks FOR ALL
  USING  (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ── Done ─────────────────────────────────────────────────────
-- After running this migration, all Placement Tools features work:
-- ✅ Resume Builder (/resume)
-- ✅ Skill Gap Analyzer (/skill-gap)
-- ✅ PYQ Bank (/pyq) — includes bookmark support
