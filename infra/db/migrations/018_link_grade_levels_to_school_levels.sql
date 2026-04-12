ALTER TABLE grade_levels
ADD COLUMN IF NOT EXISTS school_level_id UUID REFERENCES school_levels(id);

CREATE INDEX IF NOT EXISTS idx_grade_levels_school_level_id
  ON grade_levels(school_level_id);