-- =========================================================
-- PEOPLE
-- =========================================================
CREATE TABLE teachers (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
user_id UUID NOT NULL UNIQUE REFERENCES users(id),
employee_code VARCHAR(50) NULL,
first_name VARCHAR(120) NOT NULL,
last_name VARCHAR(120) NOT NULL,
phone VARCHAR(50) NULL,
email_override VARCHAR(255) NULL,
is_active BOOLEAN NOT NULL DEFAULT TRUE,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL


);

CREATE TRIGGER trg_teachers_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE sections
ADD CONSTRAINT fk_sections_homeroom_teacher
FOREIGN KEY (homeroom_teacher_id) REFERENCES teachers(id);

CREATE TABLE guardians (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
user_id UUID NOT NULL UNIQUE REFERENCES users(id),
first_name VARCHAR(120) NOT NULL,
last_name VARCHAR(120) NOT NULL,
phone VARCHAR(50) NULL,
secondary_phone VARCHAR(50) NULL,
email_override VARCHAR(255) NULL,
receive_attendance_alerts BOOLEAN NOT NULL DEFAULT TRUE,
receive_finance_alerts BOOLEAN NOT NULL DEFAULT TRUE,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL


);

CREATE TRIGGER trg_guardians_updated_at
BEFORE UPDATE ON guardians
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE students (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
student_number VARCHAR(50) NOT NULL,
first_name VARCHAR(120) NOT NULL,
last_name VARCHAR(120) NOT NULL,
date_of_birth DATE NULL,
gender VARCHAR(20) NULL,
admission_date DATE NULL,
status student_status NOT NULL DEFAULT 'ACTIVE',


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_student_number_per_school UNIQUE (school_id, student_number)


);

CREATE TRIGGER trg_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE student_guardians (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id UUID NOT NULL REFERENCES students(id),
guardian_id UUID NOT NULL REFERENCES guardians(id),
relationship_type VARCHAR(30) NOT NULL,
is_primary BOOLEAN NOT NULL DEFAULT FALSE,
can_pick_up BOOLEAN NOT NULL DEFAULT FALSE,
can_view_finance BOOLEAN NOT NULL DEFAULT TRUE,
can_view_academics BOOLEAN NOT NULL DEFAULT TRUE,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_student_guardian UNIQUE (student_id, guardian_id)


);

CREATE TRIGGER trg_student_guardians_updated_at
BEFORE UPDATE ON student_guardians
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE enrollments (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id UUID NOT NULL REFERENCES students(id),
academic_year_id UUID NOT NULL REFERENCES academic_years(id),
grade_level_id UUID NOT NULL REFERENCES grade_levels(id),
section_id UUID NOT NULL REFERENCES sections(id),
enrollment_status enrollment_status NOT NULL DEFAULT 'ACTIVE',
start_date DATE NOT NULL,
end_date DATE NULL,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT chk_enrollment_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TRIGGER trg_enrollments_updated_at
BEFORE UPDATE ON enrollments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX uq_active_enrollment_per_student_year
ON enrollments(student_id, academic_year_id)
WHERE enrollment_status = 'ACTIVE' AND deleted_at IS NULL;