DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'attendance_session_status'
      AND e.enumlabel = 'LOCKED'
  ) THEN
    ALTER TYPE attendance_session_status ADD VALUE 'LOCKED';
  END IF;
END $$;

ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_sessions_school_section_date_slot_active
  ON attendance_sessions(school_id, section_id, attendance_date, slot)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_records_session_student_active
  ON attendance_records(attendance_session_id, student_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_date
  ON attendance_sessions(school_id, attendance_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id
  ON attendance_records(attendance_session_id)
  WHERE deleted_at IS NULL;
