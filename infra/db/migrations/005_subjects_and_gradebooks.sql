-- =========================================================
-- SUBJECTS / CURRICULUM
-- =========================================================
CREATE TABLE subjects (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
code VARCHAR(50) NOT NULL,
name_i18n JSONB NOT NULL,
default_coefficient NUMERIC(6,2) NOT NULL DEFAULT 1.00 CHECK (default_coefficient > 0),
is_core BOOLEAN NOT NULL DEFAULT TRUE,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_subject_code_per_school UNIQUE (school_id, code)


);

CREATE TRIGGER trg_subjects_updated_at
BEFORE UPDATE ON subjects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE section_subjects (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
academic_year_id UUID NOT NULL REFERENCES academic_years(id),
section_id UUID NOT NULL REFERENCES sections(id),
subject_id UUID NOT NULL REFERENCES subjects(id),
teacher_id UUID NOT NULL REFERENCES teachers(id),
coefficient NUMERIC(6,2) NOT NULL CHECK (coefficient > 0),
grading_configuration_id UUID NULL REFERENCES grading_configurations(id),
is_active BOOLEAN NOT NULL DEFAULT TRUE,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_section_subject UNIQUE (section_id, subject_id, academic_year_id)


);

CREATE TRIGGER trg_section_subjects_updated_at
BEFORE UPDATE ON section_subjects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- GRADEBOOKS / ASSESSMENTS / SCORES
-- =========================================================
CREATE TABLE gradebooks (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
section_subject_id UUID NOT NULL REFERENCES section_subjects(id),
grading_period_id UUID NOT NULL REFERENCES grading_periods(id),
status gradebook_status NOT NULL DEFAULT 'DRAFT',
submitted_by_user_id UUID NULL REFERENCES users(id),
submitted_at TIMESTAMPTZ NULL,
approved_by_user_id UUID NULL REFERENCES users(id),
approved_at TIMESTAMPTZ NULL,
published_by_user_id UUID NULL REFERENCES users(id),
published_at TIMESTAMPTZ NULL,
rejection_reason_i18n JSONB NULL,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_gradebook UNIQUE (section_subject_id, grading_period_id)


);

CREATE TRIGGER trg_gradebooks_updated_at
BEFORE UPDATE ON gradebooks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE assessments (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
gradebook_id UUID NOT NULL REFERENCES gradebooks(id),
title_i18n JSONB NOT NULL,
assessment_type assessment_type NOT NULL,
assessment_date DATE NOT NULL,
max_points_possible NUMERIC(8,2) NOT NULL CHECK (max_points_possible > 0),
weight_percent NUMERIC(6,2) NOT NULL CHECK (weight_percent > 0 AND weight_percent <= 100),
display_order SMALLINT NOT NULL DEFAULT 1,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL


);

CREATE TRIGGER trg_assessments_updated_at
BEFORE UPDATE ON assessments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE assessment_scores (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
assessment_id UUID NOT NULL REFERENCES assessments(id),
student_id UUID NOT NULL REFERENCES students(id),
raw_score NUMERIC(8,2) NOT NULL CHECK (raw_score >= 0),
teacher_comment_i18n JSONB NULL,
entered_by_user_id UUID NOT NULL REFERENCES users(id),
entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
last_modified_by_user_id UUID NULL REFERENCES users(id),
last_modified_at TIMESTAMPTZ NULL,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_assessment_student UNIQUE (assessment_id, student_id)


);

CREATE TRIGGER trg_assessment_scores_updated_at
BEFORE UPDATE ON assessment_scores
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- REPORT CARDS
-- =========================================================
CREATE TABLE report_cards (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
student_id UUID NOT NULL REFERENCES students(id),
section_id UUID NOT NULL REFERENCES sections(id),
grading_period_id UUID NOT NULL REFERENCES grading_periods(id),
status gradebook_status NOT NULL DEFAULT 'DRAFT',
overall_average NUMERIC(8,2) NULL,
rank_in_section INTEGER NULL,
attendance_summary JSONB NULL,
conduct_label_i18n JSONB NULL,
published_at TIMESTAMPTZ NULL,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_report_card UNIQUE (student_id, grading_period_id)


);

CREATE TRIGGER trg_report_cards_updated_at
BEFORE UPDATE ON report_cards
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE report_card_items (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
report_card_id UUID NOT NULL REFERENCES report_cards(id),
section_subject_id UUID NOT NULL REFERENCES section_subjects(id),
subject_name_snapshot_i18n JSONB NOT NULL,
coefficient NUMERIC(6,2) NOT NULL CHECK (coefficient > 0),
subject_average NUMERIC(8,2) NOT NULL,
passing_mark NUMERIC(8,2) NOT NULL,
teacher_comment_i18n JSONB NULL,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_report_card_item UNIQUE (report_card_id, section_subject_id)


);

CREATE TRIGGER trg_report_card_items_updated_at
BEFORE UPDATE ON report_card_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();