CREATE TABLE IF NOT EXISTS admission_exam_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  admission_application_id UUID NOT NULL REFERENCES admission_applications(id),

  exam_status TEXT NOT NULL DEFAULT 'NOT_SCHEDULED',
  scheduled_at TIMESTAMPTZ,
  location TEXT,
  supervisor_name TEXT,

  french_score NUMERIC(6,2),
  math_score NUMERIC(6,2),
  english_score NUMERIC(6,2),
  general_score NUMERIC(6,2),
  interview_score NUMERIC(6,2),
  total_score NUMERIC(6,2),
  max_score NUMERIC(6,2) NOT NULL DEFAULT 100,

  decision_status TEXT,
  notes TEXT,

  created_by_user_id UUID REFERENCES users(id),
  updated_by_user_id UUID REFERENCES users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_admission_exam_status
  CHECK (
    exam_status IN (
      'NOT_SCHEDULED',
      'SCHEDULED',
      'COMPLETED',
      'CANCELLED'
    )
  ),

  CONSTRAINT chk_admission_exam_decision_status
  CHECK (
    decision_status IS NULL OR decision_status IN (
      'PENDING',
      'ADMITTED',
      'CONDITIONALLY_ADMITTED',
      'WAITLISTED',
      'REJECTED'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admission_exam_records_application_active
  ON admission_exam_records(admission_application_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admission_exam_records_school_status
  ON admission_exam_records(school_id, exam_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admission_exam_records_scheduled_at
  ON admission_exam_records(school_id, scheduled_at)
  WHERE deleted_at IS NULL;
