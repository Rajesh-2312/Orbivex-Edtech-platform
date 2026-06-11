-- ============================================================
-- Orbivex — Placement & TPO Migration
-- Run in: Supabase Dashboard → SQL Editor
-- Date: 2026-05-27
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PLACEMENT DRIVES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS placement_drives (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id        uuid REFERENCES colleges(id) ON DELETE CASCADE,
  branch_id         uuid REFERENCES branches(id) ON DELETE SET NULL,   -- NULL = all branches
  section_id        uuid REFERENCES sections(id) ON DELETE SET NULL,   -- NULL = all sections

  company_name      text NOT NULL,
  company_logo_url  text,
  drive_date        date NOT NULL,
  drive_type        text NOT NULL DEFAULT 'on-campus',                 -- on-campus | off-campus | pool
  job_role          text NOT NULL,
  job_type          text NOT NULL DEFAULT 'full-time',                 -- full-time | internship | ppo
  location          text,
  ctc_min           numeric(10,2),
  ctc_max           numeric(10,2),
  description       text,
  eligibility_cgpa  numeric(3,2) DEFAULT 0,                           -- min CGPA (0 = no filter)
  eligibility_backlogs int DEFAULT 999,                               -- max allowed backlogs
  eligibility_batch text,                                             -- e.g. "2025" or "2024,2025"
  status            text NOT NULL DEFAULT 'scheduled',               -- scheduled | ongoing | completed | cancelled
  posted_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. DRIVE ELIGIBLE STUDENTS  (who is allowed to appear)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drive_eligible_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id    uuid NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registered  boolean NOT NULL DEFAULT false,        -- student self-registered interest
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drive_id, student_id)
);

-- ────────────────────────────────────────────────────────────
-- 3. DRIVE SELECTION ROUNDS  (written → GD → tech → HR)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drive_selection_rounds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id     uuid NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
  round_number int  NOT NULL,
  round_name   text NOT NULL,                        -- "Aptitude Test" | "Group Discussion" | "Technical Interview" | "HR Interview"
  round_date   date,
  venue        text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drive_id, round_number)
);

-- ────────────────────────────────────────────────────────────
-- 4. ROUND RESULTS  (shortlisted / eliminated per round)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drive_round_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id    uuid NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
  round_id    uuid NOT NULL REFERENCES drive_selection_rounds(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'appeared',      -- appeared | shortlisted | eliminated | absent
  score       numeric(5,2),                          -- optional written test score
  notes       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, student_id)
);

-- ────────────────────────────────────────────────────────────
-- 5. OFFER LETTERS  (final placement record)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drive_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id        uuid NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_role        text,
  ctc             numeric(10,2),                     -- in LPA
  offer_date      date,
  joining_date    date,
  offer_type      text DEFAULT 'full-time',          -- full-time | internship | ppo
  status          text NOT NULL DEFAULT 'offered',   -- offered | accepted | declined | revoked
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drive_id, student_id)
);

-- ────────────────────────────────────────────────────────────
-- 6. PLACEMENT BATCH METADATA  (academic year tracking)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS placement_batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  batch_year     text NOT NULL,                      -- e.g. "2025"
  academic_year  text,                               -- e.g. "2024-25"
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (college_id, batch_year)
);

-- ────────────────────────────────────────────────────────────
-- 7. INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_placement_drives_college   ON placement_drives (college_id);
CREATE INDEX IF NOT EXISTS idx_placement_drives_date      ON placement_drives (drive_date);
CREATE INDEX IF NOT EXISTS idx_placement_drives_status    ON placement_drives (status);
CREATE INDEX IF NOT EXISTS idx_drive_eligible_drive       ON drive_eligible_students (drive_id);
CREATE INDEX IF NOT EXISTS idx_drive_eligible_student     ON drive_eligible_students (student_id);
CREATE INDEX IF NOT EXISTS idx_drive_round_results_drive  ON drive_round_results (drive_id);
CREATE INDEX IF NOT EXISTS idx_drive_round_results_stu    ON drive_round_results (student_id);
CREATE INDEX IF NOT EXISTS idx_drive_offers_drive         ON drive_offers (drive_id);
CREATE INDEX IF NOT EXISTS idx_drive_offers_student       ON drive_offers (student_id);

-- ────────────────────────────────────────────────────────────
-- 8. RLS — service role bypasses; enable RLS for safety
-- ────────────────────────────────────────────────────────────
ALTER TABLE placement_drives          ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_eligible_students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_selection_rounds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_round_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_offers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_batches         ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by Express backend)
-- No anon/public policies needed — all access goes through authenticated API.

-- ────────────────────────────────────────────────────────────
-- 9. TRIGGER — updated_at on placement_drives
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_placement_drive_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_placement_drive_updated_at ON placement_drives;
CREATE TRIGGER trg_placement_drive_updated_at
  BEFORE UPDATE ON placement_drives
  FOR EACH ROW EXECUTE FUNCTION update_placement_drive_updated_at();

-- ────────────────────────────────────────────────────────────
-- DONE — run supabase-setup.sql first if not already applied.
-- ────────────────────────────────────────────────────────────
