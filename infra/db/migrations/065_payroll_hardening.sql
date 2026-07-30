BEGIN;

ALTER TYPE payroll_run_status
  ADD VALUE IF NOT EXISTS 'REVIEWED';

ALTER TYPE payroll_run_status
  ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TYPE payroll_run_status
  ADD VALUE IF NOT EXISTS 'CLOSED';

ALTER TYPE payroll_payment_status
  ADD VALUE IF NOT EXISTS 'REVERSED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_staff_accounts_id_school
  ON school_staff_accounts(id, school_id);

INSERT INTO school_staff_accounts (
  school_id,
  user_id,
  staff_type,
  employment_status,
  created_by_user_id
)
SELECT
  membership.school_id,
  membership.user_id,
  CASE
    WHEN BOOL_OR(role.role::TEXT = 'SCHOOL_ADMIN')
      THEN 'SCHOOL_ADMIN'
    WHEN BOOL_OR(role.role::TEXT = 'FINANCE_ADMIN')
      THEN 'FINANCE_ADMIN'
    ELSE 'TEACHER'
  END,
  'ACTIVE',
  membership.user_id
FROM school_memberships membership
JOIN school_membership_roles role
  ON role.school_membership_id = membership.id
 AND role.deleted_at IS NULL
WHERE membership.membership_status = 'ACTIVE'
  AND membership.deleted_at IS NULL
  AND role.role::TEXT IN (
    'SCHOOL_ADMIN',
    'TEACHER',
    'FINANCE_ADMIN'
  )
GROUP BY
  membership.school_id,
  membership.user_id
ON CONFLICT (school_id, user_id)
WHERE deleted_at IS NULL
DO NOTHING;
ALTER TABLE payroll_staff_profiles
  ADD COLUMN IF NOT EXISTS school_staff_account_id UUID,
  ADD COLUMN IF NOT EXISTS salary_effective_from DATE;

UPDATE payroll_staff_profiles profile
SET
  school_staff_account_id = staff.id,
  updated_at = NOW()
FROM school_staff_accounts staff
WHERE profile.school_staff_account_id IS NULL
  AND profile.staff_code IS NOT NULL
  AND staff.school_id = profile.school_id
  AND staff.staff_code = profile.staff_code
  AND staff.deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_staff_profiles_id_school
  ON payroll_staff_profiles(id, school_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_profile_staff_account
  ON payroll_staff_profiles(school_id, school_staff_account_id)
  WHERE deleted_at IS NULL
    AND school_staff_account_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_payroll_profile_staff_account_school'
  ) THEN
    ALTER TABLE payroll_staff_profiles
      ADD CONSTRAINT fk_payroll_profile_staff_account_school
      FOREIGN KEY (school_staff_account_id, school_id)
      REFERENCES school_staff_accounts(id, school_id)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE payroll_staff_profiles
  VALIDATE CONSTRAINT fk_payroll_profile_staff_account_school;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_payroll_profile_base_salary_nonnegative'
  ) THEN
    ALTER TABLE payroll_staff_profiles
      ADD CONSTRAINT ck_payroll_profile_base_salary_nonnegative
      CHECK (base_salary >= 0)
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_payroll_profile_currency_code'
  ) THEN
    ALTER TABLE payroll_staff_profiles
      ADD CONSTRAINT ck_payroll_profile_currency_code
      CHECK (currency_code ~ '^[A-Z]{3}$')
      NOT VALID;
  END IF;
END $$;

ALTER TABLE payroll_staff_profiles
  VALIDATE CONSTRAINT ck_payroll_profile_base_salary_nonnegative;

ALTER TABLE payroll_staff_profiles
  VALIDATE CONSTRAINT ck_payroll_profile_currency_code;

ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS prepared_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS separation_override_reason TEXT;

UPDATE payroll_runs
SET
  prepared_by_user_id = COALESCE(
    prepared_by_user_id,
    created_by_user_id
  ),
  prepared_at = COALESCE(
    prepared_at,
    created_at
  )
WHERE prepared_by_user_id IS NULL
   OR prepared_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payroll_runs
    WHERE deleted_at IS NULL
      AND period_start IS NOT NULL
      AND period_end IS NOT NULL
      AND payroll_status <> 'CANCELLED'::payroll_run_status
    GROUP BY school_id, period_start, period_end
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate active payroll periods must be reconciled before applying payroll hardening.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_runs_school_period
  ON payroll_runs(school_id, period_start, period_end)
  WHERE deleted_at IS NULL
    AND period_start IS NOT NULL
    AND period_end IS NOT NULL
    AND payroll_status <> 'CANCELLED'::payroll_run_status;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_runs_id_school
  ON payroll_runs(id, school_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_payroll_run_period_order'
  ) THEN
    ALTER TABLE payroll_runs
      ADD CONSTRAINT ck_payroll_run_period_order
      CHECK (
        period_start IS NULL
        OR period_end IS NULL
        OR period_start <= period_end
      )
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_payroll_run_currency_code'
  ) THEN
    ALTER TABLE payroll_runs
      ADD CONSTRAINT ck_payroll_run_currency_code
      CHECK (currency_code ~ '^[A-Z]{3}$')
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_payroll_run_totals_nonnegative'
  ) THEN
    ALTER TABLE payroll_runs
      ADD CONSTRAINT ck_payroll_run_totals_nonnegative
      CHECK (
        total_gross >= 0
        AND total_allowances >= 0
        AND total_deductions >= 0
        AND total_net >= 0
      )
      NOT VALID;
  END IF;
END $$;

ALTER TABLE payroll_runs
  VALIDATE CONSTRAINT ck_payroll_run_period_order;

ALTER TABLE payroll_runs
  VALIDATE CONSTRAINT ck_payroll_run_currency_code;

ALTER TABLE payroll_runs
  VALIDATE CONSTRAINT ck_payroll_run_totals_nonnegative;

ALTER TABLE payroll_run_items
  ADD COLUMN IF NOT EXISTS staff_account_id UUID,
  ADD COLUMN IF NOT EXISTS currency_code TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_full_name TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_staff_code TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_position_title TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_department TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_employment_type TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_pay_frequency TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_base_salary NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS currency_source_mismatch BOOLEAN
    NOT NULL DEFAULT FALSE;

UPDATE payroll_run_items item
SET
  staff_account_id = profile.school_staff_account_id,
  currency_code = run.currency_code,
  snapshot_full_name = profile.full_name,
  snapshot_staff_code = profile.staff_code,
  snapshot_position_title = COALESCE(
    profile.position_title,
    profile.job_title
  ),
  snapshot_department = profile.department,
  snapshot_employment_type = profile.employment_type,
  snapshot_pay_frequency = profile.pay_frequency,
  snapshot_base_salary = profile.base_salary,
  currency_source_mismatch = (
    profile.currency_code <> run.currency_code
  ),
  updated_at = NOW()
FROM payroll_staff_profiles profile,
     payroll_runs run
WHERE profile.id = item.payroll_staff_profile_id
  AND run.id = item.payroll_run_id
  AND item.school_id = profile.school_id
  AND item.school_id = run.school_id
  AND (
    item.currency_code IS NULL
    OR item.snapshot_full_name IS NULL
    OR item.snapshot_base_salary IS NULL
  );

ALTER TABLE payroll_run_items
  ALTER COLUMN currency_code SET NOT NULL,
  ALTER COLUMN snapshot_full_name SET NOT NULL,
  ALTER COLUMN snapshot_base_salary SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_run_item_profile
  ON payroll_run_items(
    school_id,
    payroll_run_id,
    payroll_staff_profile_id
  )
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_payroll_item_run_school'
  ) THEN
    ALTER TABLE payroll_run_items
      ADD CONSTRAINT fk_payroll_item_run_school
      FOREIGN KEY (payroll_run_id, school_id)
      REFERENCES payroll_runs(id, school_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_payroll_item_profile_school'
  ) THEN
    ALTER TABLE payroll_run_items
      ADD CONSTRAINT fk_payroll_item_profile_school
      FOREIGN KEY (payroll_staff_profile_id, school_id)
      REFERENCES payroll_staff_profiles(id, school_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_payroll_item_staff_account_school'
  ) THEN
    ALTER TABLE payroll_run_items
      ADD CONSTRAINT fk_payroll_item_staff_account_school
      FOREIGN KEY (staff_account_id, school_id)
      REFERENCES school_staff_accounts(id, school_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_payroll_item_amounts'
  ) THEN
    ALTER TABLE payroll_run_items
      ADD CONSTRAINT ck_payroll_item_amounts
      CHECK (
        gross_salary >= 0
        AND allowances >= 0
        AND deductions >= 0
        AND net_salary >= 0
        AND snapshot_base_salary >= 0
        AND net_salary = gross_salary + allowances - deductions
      )
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_payroll_item_currency_code'
  ) THEN
    ALTER TABLE payroll_run_items
      ADD CONSTRAINT ck_payroll_item_currency_code
      CHECK (currency_code ~ '^[A-Z]{3}$')
      NOT VALID;
  END IF;
END $$;

ALTER TABLE payroll_run_items
  VALIDATE CONSTRAINT fk_payroll_item_run_school;

ALTER TABLE payroll_run_items
  VALIDATE CONSTRAINT fk_payroll_item_profile_school;

ALTER TABLE payroll_run_items
  VALIDATE CONSTRAINT fk_payroll_item_staff_account_school;

ALTER TABLE payroll_run_items
  VALIDATE CONSTRAINT ck_payroll_item_amounts;

ALTER TABLE payroll_run_items
  VALIDATE CONSTRAINT ck_payroll_item_currency_code;

CREATE TABLE IF NOT EXISTS payroll_item_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payroll_run_item_id UUID NOT NULL REFERENCES payroll_run_items(id),
  adjustment_type TEXT NOT NULL CHECK (
    adjustment_type IN (
      'ALLOWANCE',
      'DEDUCTION'
    )
  ),
  adjustment_code TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_item_adjustment_code
  ON payroll_item_adjustments(
    payroll_run_item_id,
    adjustment_type,
    adjustment_code
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_item_adjustments_item
  ON payroll_item_adjustments(payroll_run_item_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS payroll_payment_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id),
  payroll_run_item_id UUID NOT NULL REFERENCES payroll_run_items(id),
  original_paid_at TIMESTAMPTZ NOT NULL,
  original_payment_method TEXT,
  original_payment_reference TEXT,
  reason TEXT NOT NULL,
  reversed_by_user_id UUID NOT NULL REFERENCES users(id),
  reversed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_payment_reversals_item
  ON payroll_payment_reversals(
    payroll_run_item_id,
    reversed_at DESC
  );

CREATE TABLE IF NOT EXISTS payroll_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id),
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_user_id UUID REFERENCES users(id),
  note TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_run_events_run
  ON payroll_run_events(
    payroll_run_id,
    created_at ASC
  );

CREATE TABLE IF NOT EXISTS payroll_item_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id),
  payroll_run_item_id UUID NOT NULL REFERENCES payroll_run_items(id),
  change_type TEXT NOT NULL CHECK (
    change_type IN (
      'ADJUSTMENTS_UPDATED',
      'PAYMENT_RECORDED',
      'PAYMENT_REVERSED'
    )
  ),
  reason TEXT,
  before_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  after_state JSONB NOT NULL DEFAULT '{}'::JSONB,
  actor_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_item_change_log_item
  ON payroll_item_change_log(
    payroll_run_item_id,
    created_at ASC
  );

CREATE OR REPLACE FUNCTION payroll_prepare_item_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_run payroll_runs%ROWTYPE;
  v_profile payroll_staff_profiles%ROWTYPE;
BEGIN
  SELECT *
  INTO v_run
  FROM payroll_runs
  WHERE id = NEW.payroll_run_id
    AND school_id = NEW.school_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Payroll run does not belong to the requested school.';
  END IF;

  IF v_run.payroll_status::TEXT <> 'DRAFT' THEN
    RAISE EXCEPTION
      'Payroll items can only be added to a draft run.';
  END IF;

  SELECT *
  INTO v_profile
  FROM payroll_staff_profiles
  WHERE id = NEW.payroll_staff_profile_id
    AND school_id = NEW.school_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Payroll profile does not belong to the requested school.';
  END IF;

  IF v_profile.currency_code <> v_run.currency_code THEN
    RAISE EXCEPTION
      'Payroll profile currency must match payroll run currency.';
  END IF;

  NEW.staff_account_id := v_profile.school_staff_account_id;
  NEW.currency_code := v_run.currency_code;
  NEW.snapshot_full_name := v_profile.full_name;
  NEW.snapshot_staff_code := v_profile.staff_code;
  NEW.snapshot_position_title := COALESCE(
    v_profile.position_title,
    v_profile.job_title
  );
  NEW.snapshot_department := v_profile.department;
  NEW.snapshot_employment_type := v_profile.employment_type;
  NEW.snapshot_pay_frequency := v_profile.pay_frequency;
  NEW.snapshot_base_salary := v_profile.base_salary;
  NEW.currency_source_mismatch := FALSE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_prepare_item_snapshot
  ON payroll_run_items;

CREATE TRIGGER trg_payroll_prepare_item_snapshot
BEFORE INSERT OR UPDATE OF
  payroll_run_id,
  payroll_staff_profile_id,
  school_id
ON payroll_run_items
FOR EACH ROW
EXECUTE FUNCTION payroll_prepare_item_snapshot();

CREATE OR REPLACE FUNCTION payroll_guard_run_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_from TEXT;
  v_to TEXT;
BEGIN
  IF OLD.payroll_status::TEXT = 'CLOSED' THEN
    RAISE EXCEPTION 'Closed payroll runs are locked.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_from := OLD.payroll_status::TEXT;
  v_to := NEW.payroll_status::TEXT;

  IF v_from <> v_to
     AND NOT (
       (v_from = 'DRAFT' AND v_to IN ('REVIEWED', 'CANCELLED'))
       OR (v_from = 'REVIEWED' AND v_to IN ('DRAFT', 'APPROVED', 'CANCELLED'))
       OR (v_from = 'APPROVED' AND v_to = 'PROCESSING')
       OR (v_from = 'PROCESSING' AND v_to = 'PAID')
       OR (v_from = 'PAID' AND v_to IN ('PROCESSING', 'CLOSED'))
     ) THEN
    RAISE EXCEPTION
      'Invalid payroll status transition from % to %.',
      v_from,
      v_to;
  END IF;

  IF v_from <> 'DRAFT'
     AND (
       NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.period_label IS DISTINCT FROM OLD.period_label
       OR NEW.period_start IS DISTINCT FROM OLD.period_start
       OR NEW.period_end IS DISTINCT FROM OLD.period_end
       OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
       OR NEW.total_gross IS DISTINCT FROM OLD.total_gross
       OR NEW.total_allowances IS DISTINCT FROM OLD.total_allowances
       OR NEW.total_deductions IS DISTINCT FROM OLD.total_deductions
       OR NEW.total_net IS DISTINCT FROM OLD.total_net
     ) THEN
    RAISE EXCEPTION
      'Approved or processed payroll financial data is immutable.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_guard_run_update
  ON payroll_runs;

CREATE TRIGGER trg_payroll_guard_run_update
BEFORE UPDATE OR DELETE
ON payroll_runs
FOR EACH ROW
EXECUTE FUNCTION payroll_guard_run_update();

CREATE OR REPLACE FUNCTION payroll_guard_item_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_run_status TEXT;
  v_run_id UUID;
BEGIN
  v_run_id := COALESCE(
    NEW.payroll_run_id,
    OLD.payroll_run_id
  );

  SELECT payroll_status::TEXT
  INTO v_run_status
  FROM payroll_runs
  WHERE id = v_run_id;

  IF v_run_status = 'CLOSED' THEN
    RAISE EXCEPTION 'Closed payroll runs are locked.';
  END IF;

  IF TG_OP = 'DELETE' AND v_run_status <> 'DRAFT' THEN
    RAISE EXCEPTION
      'Payroll items can only be removed from a draft run.';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.payroll_run_id IS DISTINCT FROM OLD.payroll_run_id
       OR NEW.payroll_staff_profile_id IS DISTINCT FROM OLD.payroll_staff_profile_id
       OR NEW.staff_account_id IS DISTINCT FROM OLD.staff_account_id
       OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
       OR NEW.snapshot_full_name IS DISTINCT FROM OLD.snapshot_full_name
       OR NEW.snapshot_staff_code IS DISTINCT FROM OLD.snapshot_staff_code
       OR NEW.snapshot_position_title IS DISTINCT FROM OLD.snapshot_position_title
       OR NEW.snapshot_department IS DISTINCT FROM OLD.snapshot_department
       OR NEW.snapshot_employment_type IS DISTINCT FROM OLD.snapshot_employment_type
       OR NEW.snapshot_pay_frequency IS DISTINCT FROM OLD.snapshot_pay_frequency
       OR NEW.snapshot_base_salary IS DISTINCT FROM OLD.snapshot_base_salary
       OR NEW.gross_salary IS DISTINCT FROM OLD.gross_salary
       OR NEW.allowances IS DISTINCT FROM OLD.allowances
       OR NEW.deductions IS DISTINCT FROM OLD.deductions
       OR NEW.net_salary IS DISTINCT FROM OLD.net_salary
     )
     AND v_run_status <> 'DRAFT' THEN
    RAISE EXCEPTION
      'Payroll compensation data is immutable after review.';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     )
     AND v_run_status NOT IN ('PROCESSING', 'PAID') THEN
    RAISE EXCEPTION
      'Payroll payments can only change while processing.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_guard_item_mutation
  ON payroll_run_items;

CREATE TRIGGER trg_payroll_guard_item_mutation
BEFORE UPDATE OR DELETE
ON payroll_run_items
FOR EACH ROW
EXECUTE FUNCTION payroll_guard_item_mutation();

CREATE OR REPLACE FUNCTION payroll_guard_adjustment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_id UUID;
  v_status TEXT;
BEGIN
  v_item_id := COALESCE(
    NEW.payroll_run_item_id,
    OLD.payroll_run_item_id
  );

  SELECT run.payroll_status::TEXT
  INTO v_status
  FROM payroll_run_items item
  JOIN payroll_runs run
    ON run.id = item.payroll_run_id
  WHERE item.id = v_item_id;

  IF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION
      'Payroll adjustments can only change while the run is draft.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_guard_adjustment_mutation
  ON payroll_item_adjustments;

CREATE TRIGGER trg_payroll_guard_adjustment_mutation
BEFORE INSERT OR UPDATE OR DELETE
ON payroll_item_adjustments
FOR EACH ROW
EXECUTE FUNCTION payroll_guard_adjustment_mutation();

CREATE OR REPLACE FUNCTION payroll_guard_reversal_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT payroll_status::TEXT
  INTO v_status
  FROM payroll_runs
  WHERE id = NEW.payroll_run_id
    AND school_id = NEW.school_id;

  IF v_status = 'CLOSED' THEN
    RAISE EXCEPTION
      'Closed payroll runs are locked.';
  END IF;

  IF v_status NOT IN ('PROCESSING', 'PAID') THEN
    RAISE EXCEPTION
      'Payroll payments can only be reversed during processing or after payment.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_guard_reversal_insert
  ON payroll_payment_reversals;

CREATE TRIGGER trg_payroll_guard_reversal_insert
BEFORE INSERT
ON payroll_payment_reversals
FOR EACH ROW
EXECUTE FUNCTION payroll_guard_reversal_insert();

COMMIT;
