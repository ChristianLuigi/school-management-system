DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_card_batch_status') THEN
    CREATE TYPE report_card_batch_status AS ENUM (
      'DRAFT',
      'GENERATED',
      'PUBLISHED',
      'ARCHIVED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS report_card_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  grading_period_id UUID NOT NULL REFERENCES grading_periods(id),
  section_id UUID REFERENCES sections(id),
  batch_status report_card_batch_status NOT NULL DEFAULT 'GENERATED',
  generated_by_user_id UUID REFERENCES users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by_user_id UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE report_cards
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES report_card_batches(id),
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id),
  ADD COLUMN IF NOT EXISTS average_score NUMERIC(8, 3),
  ADD COLUMN IF NOT EXISTS conduct_note TEXT,
  ADD COLUMN IF NOT EXISTS subject_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE report_cards rc
SET school_id = st.school_id
FROM students st
WHERE rc.student_id = st.id
  AND rc.school_id IS NULL;

UPDATE report_cards
SET attendance_summary = '{}'::jsonb
WHERE attendance_summary IS NULL;

ALTER TABLE report_cards
  ALTER COLUMN attendance_summary SET DEFAULT '{}'::jsonb,
  ALTER COLUMN attendance_summary SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_cards_batch_student_active
  ON report_cards(batch_id, student_id)
  WHERE deleted_at IS NULL
    AND batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_report_card_batches_school_period
  ON report_card_batches(school_id, grading_period_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_report_cards_school_period_section
  ON report_cards(school_id, grading_period_id, section_id)
  WHERE deleted_at IS NULL;
