BEGIN;

ALTER TABLE school_staff_accounts
  ADD COLUMN IF NOT EXISTS status_effective_date DATE
    NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS status_reason TEXT
    NOT NULL DEFAULT 'Staff record created.',
  ADD COLUMN IF NOT EXISTS employment_status_changed_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS employment_status_changed_by_user_id UUID
    REFERENCES users(id);

UPDATE school_staff_accounts
SET
  status_effective_date = CASE
    WHEN employment_status = 'TERMINATED'
      THEN COALESCE(termination_date, hire_date, created_at::DATE)
    ELSE COALESCE(hire_date, created_at::DATE)
  END,
  status_reason = CASE
    WHEN status_reason = 'Staff record created.'
      THEN 'Imported existing staff status.'
    ELSE status_reason
  END,
  employment_status_changed_at = COALESCE(
    employment_status_changed_at,
    updated_at,
    created_at
  ),
  employment_status_changed_by_user_id = COALESCE(
    employment_status_changed_by_user_id,
    created_by_user_id
  );

ALTER TABLE school_staff_accounts
  DROP CONSTRAINT IF EXISTS school_staff_accounts_status_reason_check,
  ADD CONSTRAINT school_staff_accounts_status_reason_check
  CHECK (NULLIF(BTRIM(status_reason), '') IS NOT NULL),
  DROP CONSTRAINT IF EXISTS school_staff_accounts_status_effective_date_check,
  ADD CONSTRAINT school_staff_accounts_status_effective_date_check
  CHECK (status_effective_date IS NOT NULL);

CREATE TABLE IF NOT EXISTS staff_employment_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  staff_account_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  employment_type TEXT NOT NULL CHECK (
    employment_type IN (
      'FULL_TIME',
      'PART_TIME',
      'CONTRACT',
      'TEMPORARY',
      'VOLUNTEER'
    )
  ),
  position_title TEXT,
  department TEXT,
  work_location TEXT,
  reason TEXT NOT NULL,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_staff_employment_period_dates CHECK (
    end_date IS NULL
    OR end_date >= start_date
  ),
  CONSTRAINT fk_staff_employment_period_school
    FOREIGN KEY (staff_account_id, school_id)
    REFERENCES school_staff_accounts(id, school_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_employment_period_id_school
  ON staff_employment_periods(id, school_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_employment_period_open
  ON staff_employment_periods(
    school_id,
    staff_account_id
  )
  WHERE deleted_at IS NULL
    AND end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_employment_period_history
  ON staff_employment_periods(
    staff_account_id,
    start_date DESC
  )
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS staff_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  staff_account_id UUID NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  side_effects JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_staff_status_event_previous CHECK (
    previous_status IS NULL
    OR previous_status IN (
      'DRAFT',
      'ACTIVE',
      'ON_LEAVE',
      'SUSPENDED',
      'TERMINATED',
      'ARCHIVED'
    )
  ),
  CONSTRAINT ck_staff_status_event_new CHECK (
    new_status IN (
      'DRAFT',
      'ACTIVE',
      'ON_LEAVE',
      'SUSPENDED',
      'TERMINATED',
      'ARCHIVED'
    )
  ),
  CONSTRAINT ck_staff_status_event_reason CHECK (
    NULLIF(BTRIM(reason), '') IS NOT NULL
  ),
  CONSTRAINT fk_staff_status_event_school
    FOREIGN KEY (staff_account_id, school_id)
    REFERENCES school_staff_accounts(id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_status_event_history
  ON staff_status_events(
    staff_account_id,
    effective_date DESC,
    created_at DESC
  );

CREATE TABLE IF NOT EXISTS staff_position_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  staff_account_id UUID NOT NULL,
  position_title TEXT,
  department TEXT,
  supervisor_staff_account_id UUID,
  work_location TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  change_reason TEXT NOT NULL,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_staff_position_assignment_dates CHECK (
    end_date IS NULL
    OR end_date >= start_date
  ),
  CONSTRAINT ck_staff_position_assignment_reason CHECK (
    NULLIF(BTRIM(change_reason), '') IS NOT NULL
  ),
  CONSTRAINT ck_staff_position_supervisor_self CHECK (
    supervisor_staff_account_id IS NULL
    OR supervisor_staff_account_id <> staff_account_id
  ),
  CONSTRAINT fk_staff_position_staff_school
    FOREIGN KEY (staff_account_id, school_id)
    REFERENCES school_staff_accounts(id, school_id),
  CONSTRAINT fk_staff_position_supervisor_school
    FOREIGN KEY (supervisor_staff_account_id, school_id)
    REFERENCES school_staff_accounts(id, school_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_position_assignment_id_school
  ON staff_position_assignments(id, school_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_primary_position_open
  ON staff_position_assignments(
    school_id,
    staff_account_id
  )
  WHERE deleted_at IS NULL
    AND end_date IS NULL
    AND is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_staff_position_history
  ON staff_position_assignments(
    staff_account_id,
    start_date DESC
  )
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_staff_sequences (
  school_id UUID PRIMARY KEY REFERENCES schools(id),
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO school_staff_sequences (
  school_id,
  last_number
)
SELECT
  school_id,
  COALESCE(
    MAX(
      CASE
        WHEN staff_code ~ '^STF-[0-9]+$'
          THEN SUBSTRING(staff_code FROM 5)::INTEGER
        ELSE 0
      END
    ),
    0
  )
FROM school_staff_accounts
GROUP BY school_id
ON CONFLICT (school_id)
DO UPDATE SET
  last_number = GREATEST(
    school_staff_sequences.last_number,
    EXCLUDED.last_number
  ),
  updated_at = NOW();

CREATE OR REPLACE FUNCTION next_school_staff_code(
  p_school_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  INSERT INTO school_staff_sequences (
    school_id,
    last_number
  )
  VALUES (
    p_school_id,
    1
  )
  ON CONFLICT (school_id)
  DO UPDATE SET
    last_number =
      school_staff_sequences.last_number + 1,
    updated_at = NOW()
  RETURNING last_number
  INTO next_number;

  RETURN 'STF-' || LPAD(
    next_number::TEXT,
    6,
    '0'
  );
END;
$$;

INSERT INTO staff_status_events (
  school_id,
  staff_account_id,
  previous_status,
  new_status,
  effective_date,
  reason,
  actor_user_id,
  side_effects,
  created_at
)
SELECT
  staff.school_id,
  staff.id,
  NULL,
  staff.employment_status,
  staff.status_effective_date,
  staff.status_reason,
  staff.employment_status_changed_by_user_id,
  '{"source":"migration_068"}'::JSONB,
  staff.employment_status_changed_at
FROM school_staff_accounts staff
WHERE NOT EXISTS (
  SELECT 1
  FROM staff_status_events event
  WHERE event.school_id = staff.school_id
    AND event.staff_account_id = staff.id
);

INSERT INTO staff_employment_periods (
  school_id,
  staff_account_id,
  start_date,
  end_date,
  employment_type,
  position_title,
  department,
  work_location,
  reason,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  staff.school_id,
  staff.id,
  COALESCE(
    staff.hire_date,
    staff.created_at::DATE
  ),
  CASE
    WHEN staff.employment_status = 'TERMINATED'
      THEN COALESCE(
        staff.termination_date,
        staff.status_effective_date
      )
    ELSE NULL
  END,
  staff.employment_type,
  staff.job_title,
  staff.department,
  staff.work_location,
  'Imported existing employment period.',
  staff.created_by_user_id,
  staff.created_at,
  staff.updated_at
FROM school_staff_accounts staff
WHERE staff.employment_status IN (
    'ACTIVE',
    'ON_LEAVE',
    'SUSPENDED',
    'TERMINATED'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM staff_employment_periods period
    WHERE period.school_id = staff.school_id
      AND period.staff_account_id = staff.id
      AND period.deleted_at IS NULL
  );

INSERT INTO staff_position_assignments (
  school_id,
  staff_account_id,
  position_title,
  department,
  supervisor_staff_account_id,
  work_location,
  start_date,
  end_date,
  is_primary,
  change_reason,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  staff.school_id,
  staff.id,
  staff.job_title,
  staff.department,
  staff.supervisor_staff_account_id,
  staff.work_location,
  COALESCE(
    staff.hire_date,
    staff.created_at::DATE
  ),
  CASE
    WHEN staff.employment_status = 'TERMINATED'
      THEN COALESCE(
        staff.termination_date,
        staff.status_effective_date
      )
    ELSE NULL
  END,
  TRUE,
  'Imported existing primary position.',
  staff.created_by_user_id,
  staff.created_at,
  staff.updated_at
FROM school_staff_accounts staff
WHERE (
    staff.job_title IS NOT NULL
    OR staff.department IS NOT NULL
    OR staff.supervisor_staff_account_id IS NOT NULL
    OR staff.work_location IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM staff_position_assignments position
    WHERE position.school_id = staff.school_id
      AND position.staff_account_id = staff.id
      AND position.deleted_at IS NULL
  );

CREATE OR REPLACE FUNCTION staff_status_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Staff status events are append-only.';
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_status_events_append_only
  ON staff_status_events;

CREATE TRIGGER trg_staff_status_events_append_only
BEFORE UPDATE OR DELETE
ON staff_status_events
FOR EACH ROW
EXECUTE FUNCTION staff_status_events_append_only();

CREATE OR REPLACE FUNCTION guard_school_staff_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  previous_status TEXT;
  target_status TEXT;
BEGIN
  previous_status := OLD.employment_status;
  target_status := NEW.employment_status;

  IF previous_status = target_status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (
      previous_status = 'DRAFT'
      AND target_status IN (
        'ACTIVE',
        'ARCHIVED'
      )
    )
    OR (
      previous_status = 'ACTIVE'
      AND target_status IN (
        'ON_LEAVE',
        'SUSPENDED',
        'TERMINATED'
      )
    )
    OR (
      previous_status = 'ON_LEAVE'
      AND target_status IN (
        'ACTIVE',
        'SUSPENDED',
        'TERMINATED'
      )
    )
    OR (
      previous_status = 'SUSPENDED'
      AND target_status IN (
        'ACTIVE',
        'TERMINATED'
      )
    )
    OR (
      previous_status = 'TERMINATED'
      AND target_status IN (
        'ACTIVE',
        'ARCHIVED'
      )
    )
  ) THEN
    RAISE EXCEPTION
      'Invalid staff employment transition from % to %.',
      previous_status,
      target_status;
  END IF;

  IF NULLIF(BTRIM(NEW.status_reason), '') IS NULL
     OR NEW.status_reason IS NOT DISTINCT FROM OLD.status_reason THEN
    RAISE EXCEPTION
      'A new reason is required for a staff employment transition.';
  END IF;

  IF NEW.status_effective_date IS NULL
     OR NEW.status_effective_date > CURRENT_DATE THEN
    RAISE EXCEPTION
      'Staff employment transitions cannot be future-dated.';
  END IF;

  IF NEW.status_effective_date < OLD.status_effective_date THEN
    RAISE EXCEPTION
      'Staff employment transitions cannot move backwards in time.';
  END IF;

  IF target_status = 'TERMINATED' THEN
    NEW.termination_date := NEW.status_effective_date;
  ELSIF previous_status = 'TERMINATED'
        AND target_status = 'ACTIVE' THEN
    NEW.termination_date := NULL;
    NEW.hire_date := COALESCE(
      NEW.hire_date,
      NEW.status_effective_date
    );
  END IF;

  NEW.employment_status_changed_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_school_staff_status_transition
  ON school_staff_accounts;

CREATE TRIGGER trg_guard_school_staff_status_transition
BEFORE UPDATE OF employment_status
ON school_staff_accounts
FOR EACH ROW
EXECUTE FUNCTION guard_school_staff_status_transition();

CREATE OR REPLACE FUNCTION record_school_staff_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO staff_status_events (
    school_id,
    staff_account_id,
    previous_status,
    new_status,
    effective_date,
    reason,
    actor_user_id,
    side_effects
  )
  VALUES (
    NEW.school_id,
    NEW.id,
    OLD.employment_status,
    NEW.employment_status,
    NEW.status_effective_date,
    NEW.status_reason,
    NEW.employment_status_changed_by_user_id,
    '{}'::JSONB
  );

  IF NEW.employment_status = 'TERMINATED' THEN
    UPDATE staff_employment_periods
    SET
      end_date = NEW.status_effective_date,
      updated_at = NOW()
    WHERE school_id = NEW.school_id
      AND staff_account_id = NEW.id
      AND end_date IS NULL
      AND deleted_at IS NULL;

    UPDATE staff_position_assignments
    SET
      end_date = NEW.status_effective_date,
      updated_at = NOW()
    WHERE school_id = NEW.school_id
      AND staff_account_id = NEW.id
      AND end_date IS NULL
      AND deleted_at IS NULL;
  ELSIF NEW.employment_status = 'ACTIVE'
        AND OLD.employment_status IN (
          'DRAFT',
          'TERMINATED'
        ) THEN
    INSERT INTO staff_employment_periods (
      school_id,
      staff_account_id,
      start_date,
      employment_type,
      position_title,
      department,
      work_location,
      reason,
      created_by_user_id
    )
    VALUES (
      NEW.school_id,
      NEW.id,
      NEW.status_effective_date,
      NEW.employment_type,
      NEW.job_title,
      NEW.department,
      NEW.work_location,
      NEW.status_reason,
      NEW.employment_status_changed_by_user_id
    );

    IF NEW.job_title IS NOT NULL
       OR NEW.department IS NOT NULL
       OR NEW.supervisor_staff_account_id IS NOT NULL
       OR NEW.work_location IS NOT NULL THEN
      INSERT INTO staff_position_assignments (
        school_id,
        staff_account_id,
        position_title,
        department,
        supervisor_staff_account_id,
        work_location,
        start_date,
        is_primary,
        change_reason,
        created_by_user_id
      )
      VALUES (
        NEW.school_id,
        NEW.id,
        NEW.job_title,
        NEW.department,
        NEW.supervisor_staff_account_id,
        NEW.work_location,
        NEW.status_effective_date,
        TRUE,
        NEW.status_reason,
        NEW.employment_status_changed_by_user_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_school_staff_status_history
  ON school_staff_accounts;

CREATE TRIGGER trg_record_school_staff_status_history
AFTER UPDATE OF employment_status
ON school_staff_accounts
FOR EACH ROW
WHEN (
  OLD.employment_status IS DISTINCT FROM
    NEW.employment_status
)
EXECUTE FUNCTION record_school_staff_status_history();

CREATE OR REPLACE FUNCTION initialize_school_staff_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO staff_status_events (
    school_id,
    staff_account_id,
    previous_status,
    new_status,
    effective_date,
    reason,
    actor_user_id,
    side_effects
  )
  VALUES (
    NEW.school_id,
    NEW.id,
    NULL,
    NEW.employment_status,
    NEW.status_effective_date,
    NEW.status_reason,
    NEW.created_by_user_id,
    '{"source":"staff_record_created"}'::JSONB
  );

  IF NEW.employment_status IN (
    'ACTIVE',
    'ON_LEAVE',
    'SUSPENDED',
    'TERMINATED'
  ) THEN
    INSERT INTO staff_employment_periods (
      school_id,
      staff_account_id,
      start_date,
      end_date,
      employment_type,
      position_title,
      department,
      work_location,
      reason,
      created_by_user_id
    )
    VALUES (
      NEW.school_id,
      NEW.id,
      COALESCE(
        NEW.hire_date,
        NEW.status_effective_date
      ),
      CASE
        WHEN NEW.employment_status = 'TERMINATED'
          THEN NEW.termination_date
        ELSE NULL
      END,
      NEW.employment_type,
      NEW.job_title,
      NEW.department,
      NEW.work_location,
      NEW.status_reason,
      NEW.created_by_user_id
    );
  END IF;

  IF (
    NEW.job_title IS NOT NULL
    OR NEW.department IS NOT NULL
    OR NEW.supervisor_staff_account_id IS NOT NULL
    OR NEW.work_location IS NOT NULL
  )
  AND NEW.employment_status <> 'DRAFT'
  AND NEW.employment_status <> 'ARCHIVED' THEN
    INSERT INTO staff_position_assignments (
      school_id,
      staff_account_id,
      position_title,
      department,
      supervisor_staff_account_id,
      work_location,
      start_date,
      end_date,
      is_primary,
      change_reason,
      created_by_user_id
    )
    VALUES (
      NEW.school_id,
      NEW.id,
      NEW.job_title,
      NEW.department,
      NEW.supervisor_staff_account_id,
      NEW.work_location,
      COALESCE(
        NEW.hire_date,
        NEW.status_effective_date
      ),
      CASE
        WHEN NEW.employment_status = 'TERMINATED'
          THEN NEW.termination_date
        ELSE NULL
      END,
      TRUE,
      NEW.status_reason,
      NEW.created_by_user_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initialize_school_staff_history
  ON school_staff_accounts;

CREATE TRIGGER trg_initialize_school_staff_history
AFTER INSERT
ON school_staff_accounts
FOR EACH ROW
EXECUTE FUNCTION initialize_school_staff_history();

COMMIT;
