-- =========================================================
-- ACADEMIC STRUCTURE
-- =========================================================
CREATE TABLE academic_years (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
name_i18n JSONB NOT NULL,
start_date DATE NOT NULL,
end_date DATE NOT NULL,
status academic_year_status NOT NULL DEFAULT 'PLANNED',


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT chk_academic_year_dates CHECK (end_date > start_date)


);

CREATE TRIGGER trg_academic_years_updated_at
BEFORE UPDATE ON academic_years
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE grade_levels (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
code VARCHAR(30) NOT NULL,
name_i18n JSONB NOT NULL,
display_order SMALLINT NOT NULL,
grading_configuration_id UUID NULL REFERENCES grading_configurations(id),


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_grade_level_code_per_school UNIQUE (school_id, code)


);

CREATE TRIGGER trg_grade_levels_updated_at
BEFORE UPDATE ON grade_levels
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE grading_periods (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
academic_year_id UUID NOT NULL REFERENCES academic_years(id),
period_type grading_period_type NOT NULL DEFAULT 'TRIMESTER',
sequence_no SMALLINT NOT NULL CHECK (sequence_no BETWEEN 1 AND 3),
name_i18n JSONB NOT NULL,
start_date DATE NOT NULL,
end_date DATE NOT NULL,
is_current BOOLEAN NOT NULL DEFAULT FALSE,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_grading_period_sequence UNIQUE (academic_year_id, sequence_no),
CONSTRAINT chk_grading_period_dates CHECK (end_date > start_date)


);

CREATE TRIGGER trg_grading_periods_updated_at
BEFORE UPDATE ON grading_periods
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sections (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
school_id UUID NOT NULL REFERENCES schools(id),
academic_year_id UUID NOT NULL REFERENCES academic_years(id),
grade_level_id UUID NOT NULL REFERENCES grade_levels(id),
code VARCHAR(20) NOT NULL,
name_i18n JSONB NOT NULL,
homeroom_teacher_id UUID NULL,


created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMPTZ NULL,

CONSTRAINT uq_section_per_grade_year UNIQUE (academic_year_id, grade_level_id, code)


);

CREATE TRIGGER trg_sections_updated_at
BEFORE UPDATE ON sections
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

