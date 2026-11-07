BEGIN;
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS import_reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_guardian_import_reference
  ON guardians(school_id, import_reference)
  WHERE deleted_at IS NULL AND import_reference IS NOT NULL;
COMMIT;
