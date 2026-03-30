-- =========================================================
-- ATTENDANCE
-- =========================================================
CREATE TABLE attendance_sessions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
section_id UUID NOT NULL REFERENCES sections(id),
attendance_date DATE NOT NULL,
slot attendance_slot NOT NULL,
status attendance_session_status NOT NULL DEFAULT 'DRAFT',
taken_by_user_id UUID NOT NULL REFERENCES users(id),
submitted_at TIMESTAMPTZ NULL,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_attendance_session UNIQUE (section_id, attendance_date, slot)

);

CREATE TRIGGER trg_attendance_sessions_updated_at
BEFORE UPDATE ON attendance_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE attendance_records (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id),
student_id UUID NOT NULL REFERENCES students(id),
status attendance_status NOT NULL,
note_i18n JSONB NULL,
parent_notified BOOLEAN NOT NULL DEFAULT FALSE,
parent_notified_at TIMESTAMPTZ NULL,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_attendance_record UNIQUE (attendance_session_id, student_id)

);

CREATE TRIGGER trg_attendance_records_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();