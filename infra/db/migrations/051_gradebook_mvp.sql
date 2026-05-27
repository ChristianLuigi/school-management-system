CREATE TABLE IF NOT EXISTS gradebook_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  section_id UUID NOT NULL REFERENCES sections(id),

  subject_name TEXT NOT NULL,
  title TEXT NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'QUIZ',

  assessment_date DATE,
  max_points NUMERIC(8,2) NOT NULL DEFAULT 20,
  weight_percent NUMERIC(5,2) NOT NULL DEFAULT 100,

  notes TEXT,

  created_by_user_id UUID REFERENCES users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_gradebook_assessment_type
  CHECK (
    assessment_type IN (
      'HOMEWORK',
      'QUIZ',
      'EXAM',
      'PROJECT',
      'PARTICIPATION',
      'OTHER'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_gradebook_assessments_school_section
  ON gradebook_assessments(school_id, section_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS gradebook_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  assessment_id UUID NOT NULL REFERENCES gradebook_assessments(id),
  student_id UUID NOT NULL REFERENCES students(id),

  score NUMERIC(8,2),
  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT uq_gradebook_score_assessment_student UNIQUE (assessment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_gradebook_scores_student
  ON gradebook_scores(student_id)
  WHERE deleted_at IS NULL;
