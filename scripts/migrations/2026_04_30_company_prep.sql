-- ─────────────────────────────────────────────────────────────
-- Migration: company_prep
-- Date: 2026-04-30
-- Purpose: Company placement prep feature — companies, rounds,
--   practice sessions, and multiple attempt tracking.
--
-- Tables:
--   company_rounds          — company + round definitions
--   company_round_progress  — per-student per-round unlock state
--   practice_sessions       — practice activity tracking
--   practice_responses       — per-question practice responses
--   company_round_attempts   — multiple timed test attempts per round
--
-- Also adds `topic` column to question_bank for topic-level mapping.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- 1. company_rounds
CREATE TABLE IF NOT EXISTS public.company_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_slug TEXT NOT NULL,
  company_color TEXT,
  company_tier TEXT,
  company_tagline TEXT,
  company_hiring TEXT,
  round_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  duration_minutes INTEGER,
  topics JSONB DEFAULT '[]'::jsonb,
  test_paper_id UUID REFERENCES public.test_papers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT company_rounds_unique_slug_index UNIQUE (company_slug, round_index)
);

ALTER TABLE public.company_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_rounds readable by authenticated" ON public.company_rounds;
CREATE POLICY "company_rounds readable by authenticated"
  ON public.company_rounds FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "company_rounds admin write" ON public.company_rounds;
CREATE POLICY "company_rounds admin write"
  ON public.company_rounds FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. company_round_progress
CREATE TABLE IF NOT EXISTS public.company_round_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_slug TEXT NOT NULL,
  round_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked'
    CHECK (status IN ('locked', 'unlocked', 'completed')),
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, company_slug, round_index)
);

ALTER TABLE public.company_round_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_round_progress readable by authenticated" ON public.company_round_progress;
CREATE POLICY "company_round_progress readable by authenticated"
  ON public.company_round_progress FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "company_round_progress owner write" ON public.company_round_progress;
CREATE POLICY "company_round_progress owner write"
  ON public.company_round_progress FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. practice_sessions
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  category TEXT NOT NULL,
  topic TEXT,
  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  session_minutes INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  company_round_id UUID REFERENCES public.company_rounds(id) ON DELETE SET NULL
);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "practice_sessions readable by authenticated" ON public.practice_sessions;
CREATE POLICY "practice_sessions readable by authenticated"
  ON public.practice_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "practice_sessions owner write" ON public.practice_sessions;
CREATE POLICY "practice_sessions owner write"
  ON public.practice_sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. practice_responses
CREATE TABLE IF NOT EXISTS public.practice_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  selected_option INTEGER,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.practice_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "practice_responses readable by authenticated" ON public.practice_responses;
CREATE POLICY "practice_responses readable by authenticated"
  ON public.practice_responses FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "practice_responses owner write" ON public.practice_responses;
CREATE POLICY "practice_responses owner write"
  ON public.practice_responses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. company_round_attempts
CREATE TABLE IF NOT EXISTS public.company_round_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_round_id UUID NOT NULL REFERENCES public.company_rounds(id) ON DELETE CASCADE,
  test_paper_id UUID REFERENCES public.test_papers(id) ON DELETE SET NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  obtained_marks INTEGER,
  total_marks INTEGER,
  percentage INTEGER,
  status TEXT DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'evaluated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, company_round_id, attempt_number)
);

ALTER TABLE public.company_round_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_round_attempts readable by authenticated" ON public.company_round_attempts;
CREATE POLICY "company_round_attempts readable by authenticated"
  ON public.company_round_attempts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "company_round_attempts owner write" ON public.company_round_attempts;
CREATE POLICY "company_round_attempts owner write"
  ON public.company_round_attempts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Add topic column to question_bank
ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT NULL;

COMMENT ON COLUMN public.question_bank.topic IS
  'Topic label for company-specific questions, e.g. "Number System". Maps to company_rounds.topics entries.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_rounds_slug ON public.company_rounds(company_slug);
CREATE INDEX IF NOT EXISTS idx_company_rounds_round_index ON public.company_rounds(company_slug, round_index);
CREATE INDEX IF NOT EXISTS idx_company_round_progress_student ON public.company_round_progress(student_id, company_slug);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_student ON public.practice_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_company_name ON public.practice_sessions(company_name);
CREATE INDEX IF NOT EXISTS idx_practice_responses_session ON public.practice_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_company_round_attempts_student ON public.company_round_attempts(student_id, company_round_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_company_topic
  ON public.question_bank(company_name, topic)
  WHERE company_name IS NOT NULL;

COMMIT;