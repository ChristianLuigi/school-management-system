ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'PRE_REGISTERED';
ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'REGISTERED';

CREATE TABLE IF NOT EXISTS student_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES students(id),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by_user_id UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_student_status_history_student
  ON student_status_history(student_id, changed_at DESC)
  WHERE deleted_at IS NULL;
