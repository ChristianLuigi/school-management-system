BEGIN;

ALTER TYPE enrollment_status ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_reason TEXT,
  ADD COLUMN IF NOT EXISTS ended_by_user_id UUID REFERENCES users(id);

UPDATE enrollments
SET ended_at = COALESCE(
  ended_at,
  deleted_at,
  end_date::TIMESTAMPTZ,
  updated_at
)
WHERE enrollment_status <> 'ACTIVE'
  AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_section_active_capacity
  ON enrollments(section_id)
  WHERE enrollment_status = 'ACTIVE'
    AND deleted_at IS NULL;

COMMIT;
