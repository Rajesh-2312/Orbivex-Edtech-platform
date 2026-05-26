-- ─────────────────────────────────────────────────────────────
-- Migration: course_access
-- Date: 2026-04-13
-- Purpose: Gate course visibility per college / branch / section.
--
-- Rule enforced at application layer:
--   * If a course has ZERO rows in course_access  -> public (all students).
--   * If a course has >=1 rows                    -> only students whose
--     (college_id, branch_id, section_id) matches ANY row.
--     NULL in a row means "wildcard" at that level.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.course_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  college_id UUID REFERENCES public.colleges(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT course_access_scope_not_empty
    CHECK (college_id IS NOT NULL OR branch_id IS NOT NULL OR section_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_course_access_course ON public.course_access(course_id);
CREATE INDEX IF NOT EXISTS idx_course_access_section ON public.course_access(section_id);
CREATE INDEX IF NOT EXISTS idx_course_access_branch ON public.course_access(branch_id);
CREATE INDEX IF NOT EXISTS idx_course_access_college ON public.course_access(college_id);

ALTER TABLE public.course_access ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. Authenticated users can read access rows
-- for any course they could otherwise see (read-only).
DROP POLICY IF EXISTS "course_access readable by authenticated" ON public.course_access;
CREATE POLICY "course_access readable by authenticated"
  ON public.course_access FOR SELECT
  TO authenticated
  USING (true);
