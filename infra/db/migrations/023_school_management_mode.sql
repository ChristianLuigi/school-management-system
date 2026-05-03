CREATE TYPE school_management_mode AS ENUM (
  'SELF_MANAGED',
  'SUPERADMIN_MANAGED',
  'HYBRID_MANAGED'
);

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS management_mode school_management_mode
NOT NULL DEFAULT 'SELF_MANAGED';

CREATE INDEX IF NOT EXISTS idx_schools_management_mode
  ON schools(management_mode);
