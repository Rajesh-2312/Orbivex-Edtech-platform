-- ============================================================
-- Migration: LSRW proctoring — session termination + violation audit trail
-- Run in: Supabase Dashboard → SQL Editor
--
-- Detection runs in the student's browser, so it can be tampered with by anyone
-- determined enough. These server-side rows are what make it evidence: they are
-- written by the service key and cannot be edited by the student.
-- ============================================================

-- lsrw_sessions.status has no CHECK constraint, so 'terminated' needs no change.
ALTER TABLE lsrw_sessions
  ADD COLUMN IF NOT EXISTS terminated_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT;

CREATE TABLE IF NOT EXISTS lsrw_proctor_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        REFERENCES lsrw_sessions(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT        NOT NULL,
  severity    TEXT        NOT NULL CHECK (severity IN ('warn','terminate')),
  details     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lsrw_proctor_events_session
  ON lsrw_proctor_events (session_id, created_at);

-- Staff review "who got terminated this week" far more often than any other query.
CREATE INDEX IF NOT EXISTS lsrw_proctor_events_student
  ON lsrw_proctor_events (student_id, created_at DESC)
  WHERE severity = 'terminate';

-- RLS mirrors the existing student-own-rows policies on lsrw_sessions/evaluations.
-- Read-only for students: they may see why they were terminated, never rewrite it.
ALTER TABLE lsrw_proctor_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_own_proctor_events" ON lsrw_proctor_events;
CREATE POLICY "student_own_proctor_events" ON lsrw_proctor_events
  FOR SELECT USING (auth.uid() = student_id);
