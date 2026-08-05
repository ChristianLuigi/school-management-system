BEGIN;

ALTER TABLE teacher_academic_assignments
  ADD COLUMN IF NOT EXISTS teacher_staff_account_id UUID;

UPDATE teacher_academic_assignments assignment
SET teacher_staff_account_id = staff.id
FROM school_staff_accounts staff
WHERE assignment.teacher_staff_account_id IS NULL
  AND staff.school_id = assignment.school_id
  AND staff.user_id = assignment.teacher_user_id
  AND staff.deleted_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM teacher_academic_assignments
    WHERE teacher_staff_account_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Teacher assignments without a matching staff account must be reconciled before applying S6.';
  END IF;
END $$;

ALTER TABLE teacher_academic_assignments
  ALTER COLUMN teacher_staff_account_id SET NOT NULL,
  ALTER COLUMN teacher_user_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_teacher_assignment_staff_school'
      AND conrelid = 'teacher_academic_assignments'::REGCLASS
  ) THEN
    ALTER TABLE teacher_academic_assignments
      ADD CONSTRAINT fk_teacher_assignment_staff_school
      FOREIGN KEY (
        teacher_staff_account_id,
        school_id
      )
      REFERENCES school_staff_accounts(id, school_id)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE teacher_academic_assignments
  VALIDATE CONSTRAINT fk_teacher_assignment_staff_school;

CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_academic_assignment_staff
  ON teacher_academic_assignments(
    school_id,
    teacher_staff_account_id,
    academic_year_id,
    section_id,
    subject_id
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_assignment_staff_scope
  ON teacher_academic_assignments(
    teacher_staff_account_id,
    academic_year_id,
    section_id
  )
  WHERE deleted_at IS NULL
    AND assignment_status = 'ACTIVE';

CREATE OR REPLACE FUNCTION enforce_teacher_assignment_staff_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  staff_record school_staff_accounts%ROWTYPE;
BEGIN
  IF NEW.teacher_staff_account_id IS NULL
     AND NEW.teacher_user_id IS NOT NULL THEN
    SELECT staff.*
    INTO staff_record
    FROM school_staff_accounts staff
    WHERE staff.school_id = NEW.school_id
      AND staff.user_id = NEW.teacher_user_id
      AND staff.staff_category = 'TEACHING'
      AND staff.deleted_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      NEW.teacher_staff_account_id := staff_record.id;
    END IF;
  END IF;

  IF NEW.teacher_staff_account_id IS NULL THEN
    RAISE EXCEPTION
      'A teacher assignment requires a school staff account.';
  END IF;

  SELECT staff.*
  INTO staff_record
  FROM school_staff_accounts staff
  WHERE staff.id = NEW.teacher_staff_account_id
    AND staff.school_id = NEW.school_id
    AND staff.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'The teacher staff account does not belong to this school.';
  END IF;

  IF staff_record.staff_category <> 'TEACHING' THEN
    RAISE EXCEPTION
      'Only teaching staff can receive academic assignments.';
  END IF;

  IF NEW.assignment_status = 'ACTIVE'
     AND staff_record.employment_status <> 'ACTIVE' THEN
    RAISE EXCEPTION
      'Only active teaching staff can receive active academic assignments.';
  END IF;

  IF staff_record.user_id IS NOT NULL THEN
    IF NEW.teacher_user_id IS NOT NULL
       AND NEW.teacher_user_id <> staff_record.user_id THEN
      RAISE EXCEPTION
        'The legacy teacher user does not match the linked staff account.';
    END IF;
    NEW.teacher_user_id := staff_record.user_id;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.teacher_user_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_teacher_assignment_staff_scope
  ON teacher_academic_assignments;

CREATE TRIGGER trg_enforce_teacher_assignment_staff_scope
BEFORE INSERT OR UPDATE OF
  teacher_staff_account_id,
  teacher_user_id,
  school_id,
  assignment_status
ON teacher_academic_assignments
FOR EACH ROW
EXECUTE FUNCTION enforce_teacher_assignment_staff_scope();

CREATE OR REPLACE FUNCTION enforce_staff_assignment_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_assignment_status TEXT;
BEGIN
  IF NEW.staff_category <> 'TEACHING' THEN
    target_assignment_status := 'ARCHIVED';
  ELSIF NEW.employment_status = 'SUSPENDED' THEN
    target_assignment_status := 'SUSPENDED';
  ELSIF NEW.employment_status IN ('TERMINATED', 'ARCHIVED') THEN
    target_assignment_status := 'ARCHIVED';
  ELSE
    RETURN NEW;
  END IF;

  UPDATE teacher_academic_assignments
  SET
    assignment_status = target_assignment_status,
    updated_at = NOW()
  WHERE school_id = NEW.school_id
    AND teacher_staff_account_id = NEW.id
    AND assignment_status = 'ACTIVE'
    AND deleted_at IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_staff_assignment_lifecycle
  ON school_staff_accounts;

CREATE TRIGGER trg_enforce_staff_assignment_lifecycle
AFTER UPDATE OF
  employment_status,
  staff_category
ON school_staff_accounts
FOR EACH ROW
WHEN (
  OLD.employment_status IS DISTINCT FROM NEW.employment_status
  OR OLD.staff_category IS DISTINCT FROM NEW.staff_category
)
EXECUTE FUNCTION enforce_staff_assignment_lifecycle();

COMMIT;
