-- =========================================================
-- ANNOUNCEMENTS / NOTIFICATIONS
-- =========================================================
CREATE TABLE announcements (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
created_by_user_id UUID NOT NULL REFERENCES users(id),
audience_type audience_type NOT NULL,
section_id UUID NULL REFERENCES sections(id),
title_i18n JSONB NOT NULL,
body_i18n JSONB NOT NULL,
publish_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
expire_at TIMESTAMPTZ NULL,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL

);

CREATE TRIGGER trg_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE notifications (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
recipient_user_id UUID NOT NULL REFERENCES users(id),
type notification_type NOT NULL,
channel notification_channel NOT NULL,
title_i18n JSONB NOT NULL,
body_i18n JSONB NOT NULL,
payload JSONB NULL,
status notification_status NOT NULL DEFAULT 'PENDING',
sent_at TIMESTAMPTZ NULL,
read_at TIMESTAMPTZ NULL,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL

);

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE audit_logs (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
actor_user_id UUID NULL REFERENCES users(id),
entity_table VARCHAR(100) NOT NULL,
entity_id UUID NOT NULL,
action audit_action NOT NULL,
old_values JSONB NULL,
new_values JSONB NULL,
request_id VARCHAR(100) NULL,
ip_address INET NULL,
occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_school_time ON audit_logs(school_id, occurred_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_table, entity_id);
CREATE INDEX idx_audit_logs_actor_time ON audit_logs(actor_user_id, occurred_at DESC);

-- =========================================================
-- JSONB INDEXES FOR I18N SEARCH
-- =========================================================
CREATE INDEX idx_subjects_name_i18n_gin ON subjects USING GIN (name_i18n);
CREATE INDEX idx_grade_levels_name_i18n_gin ON grade_levels USING GIN (name_i18n);
CREATE INDEX idx_sections_name_i18n_gin ON sections USING GIN (name_i18n);
CREATE INDEX idx_assessments_title_i18n_gin ON assessments USING GIN (title_i18n);
CREATE INDEX idx_announcements_title_i18n_gin ON announcements USING GIN (title_i18n);

-- =========================================================
-- OPERATIONAL INDEXES
-- =========================================================
CREATE INDEX idx_enrollments_section_year ON enrollments(section_id, academic_year_id)
WHERE deleted_at IS NULL;

CREATE INDEX idx_section_subjects_teacher ON section_subjects(teacher_id)
WHERE deleted_at IS NULL;

CREATE INDEX idx_gradebooks_period_status ON gradebooks(grading_period_id, status)
WHERE deleted_at IS NULL;

CREATE INDEX idx_attendance_sessions_section_date ON attendance_sessions(section_id, attendance_date)
WHERE deleted_at IS NULL;

CREATE INDEX idx_attendance_records_student ON attendance_records(student_id)
WHERE deleted_at IS NULL;

CREATE INDEX idx_invoices_student_status ON invoices(student_id, status)
WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_recipient_status ON notifications(recipient_user_id, status)
WHERE deleted_at IS NULL;