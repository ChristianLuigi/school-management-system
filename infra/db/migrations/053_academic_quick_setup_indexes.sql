CREATE UNIQUE INDEX IF NOT EXISTS uq_grade_levels_school_code_active
  ON grade_levels(school_id, code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sections_school_year_grade_code_active
  ON sections(school_id, academic_year_id, grade_level_id, code)
  WHERE deleted_at IS NULL;