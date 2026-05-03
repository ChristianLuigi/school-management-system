DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gradebook_workflow_status') THEN
    CREATE TYPE gradebook_workflow_status AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'PUBLISHED'
    );
  END IF;
END $$;

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS workflow_status gradebook_workflow_status NOT NULL DEFAULT 'DRAFT';

UPDATE gradebooks
SET workflow_status = status::text::gradebook_workflow_status
WHERE workflow_status = 'DRAFT'
  AND status::text <> 'DRAFT';

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID REFERENCES users(id);

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES users(id);

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS rejected_by_user_id UUID REFERENCES users(id);

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE gradebooks
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_gradebooks_workflow_status
  ON gradebooks(workflow_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gradebooks_grading_period_workflow
  ON gradebooks(grading_period_id, workflow_status)
  WHERE deleted_at IS NULL;
