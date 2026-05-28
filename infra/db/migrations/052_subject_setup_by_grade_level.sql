CREATE TABLE IF NOT EXISTS school_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),

  code TEXT NOT NULL,
  name_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,

  subject_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT uq_school_subject_code UNIQUE (school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_subjects_school
  ON school_subjects(school_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS grade_level_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  grade_level_id UUID NOT NULL REFERENCES grade_levels(id),
  subject_id UUID NOT NULL REFERENCES school_subjects(id),

  coefficient NUMERIC(6,2) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 100,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT uq_grade_level_subject UNIQUE (school_id, grade_level_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_grade_level_subjects_grade
  ON grade_level_subjects(school_id, grade_level_id)
  WHERE deleted_at IS NULL;

ALTER TABLE gradebook_assessments
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES school_subjects(id);
