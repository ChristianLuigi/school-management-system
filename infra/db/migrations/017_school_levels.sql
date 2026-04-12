CREATE TABLE school_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  code TEXT NOT NULL,
  name_i18n JSONB NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_school_levels_school_id
  ON school_levels(school_id);

CREATE INDEX idx_school_levels_active
  ON school_levels(school_id, is_active)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_school_levels_school_code_active
  ON school_levels(school_id, code)
  WHERE deleted_at IS NULL;