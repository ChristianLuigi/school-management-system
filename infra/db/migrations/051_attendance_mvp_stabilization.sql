CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_session_school_section_date_slot
  ON attendance_sessions(school_id, section_id, attendance_date, slot)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_record_session_student
  ON attendance_records(attendance_session_id, student_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_date_mvp
  ON attendance_sessions(school_id, attendance_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_student_mvp
  ON attendance_records(student_id)
  WHERE deleted_at IS NULL;
