BEGIN;
SET LOCAL lock_timeout = '10s';

-- Keep the replacement protection in place before removing the legacy
-- all-row constraint. Deleted identities and their histories remain untouched.
CREATE UNIQUE INDEX uq_students_school_student_number_live
  ON students (school_id, student_number)
  WHERE deleted_at IS NULL;

ALTER TABLE students DROP CONSTRAINT uq_student_number_per_school;
COMMIT;
