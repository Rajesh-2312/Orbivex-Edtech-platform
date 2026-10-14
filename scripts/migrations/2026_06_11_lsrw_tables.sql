-- ============================================================
-- Migration: LSRW sessions and evaluations tables
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS lsrw_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_type   TEXT        NOT NULL CHECK (skill_type IN ('listening','speaking','reading','writing')),
  content_id   TEXT,
  status       TEXT        NOT NULL DEFAULT 'started',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lsrw_evaluations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_type   TEXT        NOT NULL CHECK (skill_type IN ('listening','speaking','reading','writing')),
  score        NUMERIC(5,2),
  session_id   UUID        REFERENCES lsrw_sessions(id) ON DELETE SET NULL,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lsrw_evaluations_student
  ON lsrw_evaluations (student_id, skill_type, created_at DESC);

-- RLS: students can only see their own rows
ALTER TABLE lsrw_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lsrw_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_own_sessions" ON lsrw_sessions;
CREATE POLICY "student_own_sessions" ON lsrw_sessions
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "student_own_evaluations" ON lsrw_evaluations;
CREATE POLICY "student_own_evaluations" ON lsrw_evaluations
  FOR SELECT USING (auth.uid() = student_id);
