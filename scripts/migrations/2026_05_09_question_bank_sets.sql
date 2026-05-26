-- 2026-05-09 — Question bank: 5-set × 30-question pools for company-prep practice.
--
-- Adds `set_number` (1..5, nullable) so each (company, topic) can hold up to
-- five distinct 30-question variants. The companyPrep GET /questions endpoint
-- maps each student to one set via a stable hash of their student_id, so
-- different students see different question pools without per-request AI calls.
--
-- Existing rows are backfilled round-robin within each (company_name, topic)
-- bucket so the pool is immediately usable; any rows that remain NULL act as
-- a top-up fallback if a set ends up shorter than the requested limit.

ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS set_number SMALLINT
  CHECK (set_number IS NULL OR set_number BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_question_bank_company_topic_set
  ON question_bank (company_name, topic, set_number)
  WHERE company_name IS NOT NULL AND topic IS NOT NULL;

-- Round-robin backfill across the 5 sets, partitioned by (company, topic).
WITH numbered AS (
  SELECT
    id,
    ((ROW_NUMBER() OVER (
        PARTITION BY company_name, topic
        ORDER BY created_at, id
      ) - 1) % 5 + 1)::SMALLINT AS new_set
  FROM question_bank
  WHERE company_name IS NOT NULL
    AND topic IS NOT NULL
    AND test_type = 'company-specific'
    AND set_number IS NULL
)
UPDATE question_bank q
SET set_number = n.new_set
FROM numbered n
WHERE q.id = n.id;
