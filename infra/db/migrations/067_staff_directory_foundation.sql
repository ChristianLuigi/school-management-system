BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM school_staff_accounts
    WHERE deleted_at IS NULL
      AND NULLIF(BTRIM(staff_code), '') IS NOT NULL
    GROUP BY
      school_id,
      UPPER(BTRIM(staff_code))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate staff codes must be reconciled before applying the staff directory foundation.';
  END IF;
END $$;

ALTER TABLE school_staff_accounts
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS preferred_name TEXT,
  ADD COLUMN IF NOT EXISTS email_original TEXT,
  ADD COLUMN IF NOT EXISTS email_normalized TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS staff_category TEXT NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS termination_date DATE,
  ADD COLUMN IF NOT EXISTS supervisor_staff_account_id UUID,
  ADD COLUMN IF NOT EXISTS work_location TEXT,
  ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;

UPDATE school_staff_accounts staff
SET
  first_name = COALESCE(
    NULLIF(BTRIM(staff.first_name), ''),
    NULLIF(BTRIM(usr.first_name), '')
  ),
  last_name = COALESCE(
    NULLIF(BTRIM(staff.last_name), ''),
    NULLIF(BTRIM(usr.last_name), '')
  ),
  email_original = COALESCE(
    NULLIF(BTRIM(staff.email_original), ''),
    NULLIF(BTRIM(usr.email_original), ''),
    NULLIF(BTRIM(usr.email::TEXT), '')
  ),
  email_normalized = LOWER(
    COALESCE(
      NULLIF(BTRIM(staff.email_normalized), ''),
      NULLIF(BTRIM(usr.email_normalized), ''),
      NULLIF(BTRIM(usr.email_original), ''),
      NULLIF(BTRIM(usr.email::TEXT), '')
    )
  ),
  staff_category = CASE staff.staff_type
    WHEN 'SCHOOL_ADMIN' THEN 'SCHOOL_LEADERSHIP'
    WHEN 'TEACHER' THEN 'TEACHING'
    WHEN 'FINANCE_ADMIN' THEN 'FINANCE'
    ELSE staff.staff_category
  END,
  hire_date = COALESCE(
    staff.hire_date,
    staff.created_at::DATE
  ),
  staff_code = UPPER(
    NULLIF(BTRIM(staff.staff_code), '')
  ),
  job_title = NULLIF(BTRIM(staff.job_title), ''),
  department = NULLIF(BTRIM(staff.department), '')
FROM users usr
WHERE usr.id = staff.user_id;

UPDATE school_staff_accounts
SET
  staff_code = UPPER(
    NULLIF(BTRIM(staff_code), '')
  ),
  first_name = NULLIF(BTRIM(first_name), ''),
  last_name = NULLIF(BTRIM(last_name), ''),
  preferred_name = NULLIF(BTRIM(preferred_name), ''),
  email_original = NULLIF(BTRIM(email_original), ''),
  email_normalized = LOWER(
    COALESCE(
      NULLIF(BTRIM(email_original), ''),
      NULLIF(BTRIM(email_normalized), '')
    )
  ),
  phone = NULLIF(BTRIM(phone), ''),
  job_title = NULLIF(BTRIM(job_title), ''),
  department = NULLIF(BTRIM(department), ''),
  work_location = NULLIF(BTRIM(work_location), ''),
  hire_date = CASE
    WHEN employment_status IN (
      'ACTIVE',
      'ON_LEAVE',
      'SUSPENDED',
      'TERMINATED'
    )
      THEN COALESCE(hire_date, created_at::DATE)
    ELSE hire_date
  END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM school_staff_accounts
    WHERE deleted_at IS NULL
      AND email_normalized IS NOT NULL
    GROUP BY
      school_id,
      email_normalized
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate staff email addresses must be reconciled before applying the staff directory foundation.';
  END IF;
END $$;

ALTER TABLE school_staff_accounts
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN staff_type DROP NOT NULL;

ALTER TABLE school_staff_accounts
  DROP CONSTRAINT IF EXISTS school_staff_accounts_employment_status_check;

ALTER TABLE school_staff_accounts
  ADD CONSTRAINT school_staff_accounts_employment_status_check
  CHECK (
    employment_status IN (
      'DRAFT',
      'ACTIVE',
      'ON_LEAVE',
      'SUSPENDED',
      'TERMINATED',
      'ARCHIVED'
    )
  );

ALTER TABLE school_staff_accounts
  DROP CONSTRAINT IF EXISTS school_staff_accounts_staff_category_check,
  ADD CONSTRAINT school_staff_accounts_staff_category_check
  CHECK (
    staff_category IN (
      'SCHOOL_LEADERSHIP',
      'TEACHING',
      'FINANCE',
      'ADMINISTRATIVE',
      'STUDENT_SERVICES',
      'SUPPORT',
      'CONTRACTOR',
      'OTHER'
    )
  ),
  DROP CONSTRAINT IF EXISTS school_staff_accounts_employment_type_check,
  ADD CONSTRAINT school_staff_accounts_employment_type_check
  CHECK (
    employment_type IN (
      'FULL_TIME',
      'PART_TIME',
      'CONTRACT',
      'TEMPORARY',
      'VOLUNTEER'
    )
  ),
  DROP CONSTRAINT IF EXISTS school_staff_accounts_identity_check,
  ADD CONSTRAINT school_staff_accounts_identity_check
  CHECK (
    deleted_at IS NOT NULL
    OR first_name IS NOT NULL
    OR last_name IS NOT NULL
    OR email_normalized IS NOT NULL
  ),
  DROP CONSTRAINT IF EXISTS school_staff_accounts_dates_check,
  ADD CONSTRAINT school_staff_accounts_dates_check
  CHECK (
    termination_date IS NULL
    OR hire_date IS NULL
    OR termination_date >= hire_date
  ),
  DROP CONSTRAINT IF EXISTS school_staff_accounts_terminated_date_check,
  ADD CONSTRAINT school_staff_accounts_terminated_date_check
  CHECK (
    employment_status <> 'TERMINATED'
    OR termination_date IS NOT NULL
  ),
  DROP CONSTRAINT IF EXISTS school_staff_accounts_supervisor_check,
  ADD CONSTRAINT school_staff_accounts_supervisor_check
  CHECK (
    supervisor_staff_account_id IS NULL
    OR supervisor_staff_account_id <> id
  ),
  DROP CONSTRAINT IF EXISTS school_staff_accounts_row_version_check,
  ADD CONSTRAINT school_staff_accounts_row_version_check
  CHECK (row_version > 0),
  DROP CONSTRAINT IF EXISTS school_staff_accounts_email_normalized_check,
  ADD CONSTRAINT school_staff_accounts_email_normalized_check
  CHECK (
    email_normalized IS NULL
    OR email_normalized = LOWER(BTRIM(email_normalized))
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_school_staff_supervisor_school'
      AND conrelid = 'school_staff_accounts'::REGCLASS
  ) THEN
    ALTER TABLE school_staff_accounts
      ADD CONSTRAINT fk_school_staff_supervisor_school
      FOREIGN KEY (
        supervisor_staff_account_id,
        school_id
      )
      REFERENCES school_staff_accounts(
        id,
        school_id
      )
      NOT VALID;
  END IF;
END $$;

ALTER TABLE school_staff_accounts
  VALIDATE CONSTRAINT fk_school_staff_supervisor_school;

DROP INDEX IF EXISTS uq_school_staff_code;

CREATE UNIQUE INDEX uq_school_staff_code
  ON school_staff_accounts(
    school_id,
    UPPER(staff_code)
  )
  WHERE deleted_at IS NULL
    AND staff_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_staff_email
  ON school_staff_accounts(
    school_id,
    email_normalized
  )
  WHERE deleted_at IS NULL
    AND email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_staff_directory_lookup
  ON school_staff_accounts(
    school_id,
    employment_status,
    staff_category
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_school_staff_department_lookup
  ON school_staff_accounts(
    school_id,
    LOWER(department)
  )
  WHERE deleted_at IS NULL
    AND department IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_staff_supervisor
  ON school_staff_accounts(
    school_id,
    supervisor_staff_account_id
  )
  WHERE deleted_at IS NULL
    AND supervisor_staff_account_id IS NOT NULL;

CREATE OR REPLACE FUNCTION normalize_school_staff_directory_record()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  linked_user users%ROWTYPE;
BEGIN
  NEW.staff_code := UPPER(
    NULLIF(BTRIM(NEW.staff_code), '')
  );
  NEW.first_name := NULLIF(
    BTRIM(NEW.first_name),
    ''
  );
  NEW.last_name := NULLIF(
    BTRIM(NEW.last_name),
    ''
  );
  NEW.preferred_name := NULLIF(
    BTRIM(NEW.preferred_name),
    ''
  );
  NEW.email_original := NULLIF(
    BTRIM(NEW.email_original),
    ''
  );
  NEW.email_normalized := LOWER(
    COALESCE(
      NEW.email_original,
      NULLIF(BTRIM(NEW.email_normalized), '')
    )
  );
  NEW.phone := NULLIF(BTRIM(NEW.phone), '');
  NEW.job_title := NULLIF(
    BTRIM(NEW.job_title),
    ''
  );
  NEW.department := NULLIF(
    BTRIM(NEW.department),
    ''
  );
  NEW.work_location := NULLIF(
    BTRIM(NEW.work_location),
    ''
  );

  IF NEW.user_id IS NOT NULL THEN
    SELECT *
    INTO linked_user
    FROM users
    WHERE id = NEW.user_id;

    IF FOUND THEN
      NEW.first_name := COALESCE(
        NEW.first_name,
        NULLIF(BTRIM(linked_user.first_name), '')
      );
      NEW.last_name := COALESCE(
        NEW.last_name,
        NULLIF(BTRIM(linked_user.last_name), '')
      );
      NEW.email_original := COALESCE(
        NEW.email_original,
        NULLIF(BTRIM(linked_user.email_original), ''),
        NULLIF(BTRIM(linked_user.email::TEXT), '')
      );
      NEW.email_normalized := LOWER(
        COALESCE(
          NEW.email_normalized,
          NULLIF(BTRIM(linked_user.email_normalized), ''),
          NEW.email_original
        )
      );
    END IF;
  END IF;

  IF NEW.staff_category = 'OTHER' THEN
    NEW.staff_category := CASE NEW.staff_type
      WHEN 'SCHOOL_ADMIN' THEN 'SCHOOL_LEADERSHIP'
      WHEN 'TEACHER' THEN 'TEACHING'
      WHEN 'FINANCE_ADMIN' THEN 'FINANCE'
      ELSE NEW.staff_category
    END;
  END IF;

  IF NEW.hire_date IS NULL
     AND NEW.employment_status IN (
       'ACTIVE',
       'ON_LEAVE',
       'SUSPENDED',
       'TERMINATED'
     ) THEN
    NEW.hire_date := CURRENT_DATE;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.row_version := OLD.row_version + 1;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_school_staff_directory_record
  ON school_staff_accounts;

CREATE TRIGGER trg_normalize_school_staff_directory_record
BEFORE INSERT OR UPDATE
ON school_staff_accounts
FOR EACH ROW
EXECUTE FUNCTION normalize_school_staff_directory_record();

COMMIT;
