BEGIN;

CREATE TABLE IF NOT EXISTS payroll_compensation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  payroll_staff_profile_id UUID NOT NULL,
  staff_account_id UUID NOT NULL,
  effective_from DATE NOT NULL,
  compensation_type TEXT NOT NULL DEFAULT 'SALARY' CHECK (
    compensation_type IN ('SALARY', 'HOURLY', 'DAILY')
  ),
  base_amount NUMERIC(12, 2) NOT NULL CHECK (base_amount >= 0),
  currency_code TEXT NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  pay_frequency TEXT NOT NULL CHECK (
    pay_frequency IN ('MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY')
  ),
  standard_allowances JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (
    jsonb_typeof(standard_allowances) = 'array'
  ),
  standard_deductions JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (
    jsonb_typeof(standard_deductions) = 'array'
  ),
  change_reason TEXT NOT NULL CHECK (
    NULLIF(BTRIM(change_reason), '') IS NOT NULL
  ),
  approved_by_user_id UUID NOT NULL REFERENCES users(id),
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_payroll_compensation_profile_school
    FOREIGN KEY (payroll_staff_profile_id, school_id)
    REFERENCES payroll_staff_profiles(id, school_id),
  CONSTRAINT fk_payroll_compensation_staff_school
    FOREIGN KEY (staff_account_id, school_id)
    REFERENCES school_staff_accounts(id, school_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_compensation_effective_date
  ON payroll_compensation_versions(
    school_id,
    payroll_staff_profile_id,
    effective_from
  );

CREATE INDEX IF NOT EXISTS idx_payroll_compensation_effective_lookup
  ON payroll_compensation_versions(
    payroll_staff_profile_id,
    effective_from DESC
  );

INSERT INTO payroll_compensation_versions (
  school_id,
  payroll_staff_profile_id,
  staff_account_id,
  effective_from,
  compensation_type,
  base_amount,
  currency_code,
  pay_frequency,
  change_reason,
  approved_by_user_id,
  created_by_user_id,
  created_at
)
SELECT
  profile.school_id,
  profile.id,
  profile.school_staff_account_id,
  COALESCE(profile.salary_effective_from, profile.created_at::DATE),
  'SALARY',
  profile.base_salary,
  UPPER(profile.currency_code),
  CASE
    WHEN profile.pay_frequency IN (
      'MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'
    ) THEN profile.pay_frequency
    ELSE 'MONTHLY'
  END,
  'Imported existing payroll compensation.',
  COALESCE(profile.created_by_user_id, staff.created_by_user_id),
  COALESCE(profile.created_by_user_id, staff.created_by_user_id),
  profile.created_at
FROM payroll_staff_profiles profile
JOIN school_staff_accounts staff
  ON staff.id = profile.school_staff_account_id
 AND staff.school_id = profile.school_id
WHERE profile.school_staff_account_id IS NOT NULL
  AND COALESCE(profile.created_by_user_id, staff.created_by_user_id) IS NOT NULL
ON CONFLICT (
  school_id,
  payroll_staff_profile_id,
  effective_from
)
DO NOTHING;

ALTER TABLE payroll_run_items
  ADD COLUMN IF NOT EXISTS compensation_version_id UUID
    REFERENCES payroll_compensation_versions(id),
  ADD COLUMN IF NOT EXISTS snapshot_compensation_type TEXT
    NOT NULL DEFAULT 'SALARY' CHECK (
      snapshot_compensation_type IN ('SALARY', 'HOURLY', 'DAILY')
    );

CREATE OR REPLACE FUNCTION payroll_compensation_versions_are_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'Payroll compensation versions are immutable; create a new effective-dated version.';
END;
$$;

CREATE TRIGGER trg_payroll_compensation_versions_immutable
BEFORE UPDATE OR DELETE ON payroll_compensation_versions
FOR EACH ROW EXECUTE FUNCTION payroll_compensation_versions_are_immutable();

UPDATE payroll_run_items item
SET compensation_version_id = (
  SELECT version.id
  FROM payroll_compensation_versions version
  JOIN payroll_runs run
    ON run.id = item.payroll_run_id
   AND run.school_id = item.school_id
  WHERE version.school_id = item.school_id
    AND version.payroll_staff_profile_id = item.payroll_staff_profile_id
  ORDER BY
    CASE WHEN version.effective_from <= run.period_start THEN 0 ELSE 1 END,
    CASE WHEN version.effective_from <= run.period_start
      THEN version.effective_from END DESC,
    version.effective_from ASC
  LIMIT 1
)
WHERE item.compensation_version_id IS NULL;

CREATE OR REPLACE FUNCTION payroll_compensation_item_reference_is_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.compensation_version_id IS DISTINCT FROM OLD.compensation_version_id
     OR NEW.snapshot_compensation_type IS DISTINCT FROM OLD.snapshot_compensation_type
  THEN
    RAISE EXCEPTION 'Payroll compensation snapshot reference is immutable.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_zz_payroll_compensation_item_reference_immutable
BEFORE UPDATE OF compensation_version_id, snapshot_compensation_type
ON payroll_run_items
FOR EACH ROW EXECUTE FUNCTION payroll_compensation_item_reference_is_immutable();

CREATE OR REPLACE FUNCTION payroll_prepare_item_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_run payroll_runs%ROWTYPE;
  v_profile payroll_staff_profiles%ROWTYPE;
  v_compensation payroll_compensation_versions%ROWTYPE;
BEGIN
  SELECT * INTO v_run
  FROM payroll_runs
  WHERE id = NEW.payroll_run_id
    AND school_id = NEW.school_id
    AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll run does not belong to the requested school.';
  END IF;
  IF v_run.payroll_status::TEXT <> 'DRAFT' THEN
    RAISE EXCEPTION 'Payroll items can only be added to a draft run.';
  END IF;

  SELECT * INTO v_profile
  FROM payroll_staff_profiles
  WHERE id = NEW.payroll_staff_profile_id
    AND school_id = NEW.school_id
    AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll profile does not belong to the requested school.';
  END IF;

  IF NEW.compensation_version_id IS NOT NULL THEN
    SELECT * INTO v_compensation
    FROM payroll_compensation_versions
    WHERE id = NEW.compensation_version_id
      AND school_id = NEW.school_id
      AND payroll_staff_profile_id = NEW.payroll_staff_profile_id;
  ELSE
    SELECT * INTO v_compensation
    FROM payroll_compensation_versions
    WHERE school_id = NEW.school_id
      AND payroll_staff_profile_id = NEW.payroll_staff_profile_id
      AND effective_from <= v_run.period_start
    ORDER BY effective_from DESC, created_at DESC
    LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No compensation version is effective for this payroll period.';
  END IF;
  IF v_compensation.currency_code <> v_run.currency_code THEN
    RAISE EXCEPTION 'Compensation currency must match payroll run currency.';
  END IF;

  NEW.compensation_version_id := v_compensation.id;
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
  NEW.snapshot_pay_frequency := v_compensation.pay_frequency;
  NEW.snapshot_compensation_type := v_compensation.compensation_type;
  NEW.snapshot_base_salary := v_compensation.base_amount;
  NEW.currency_source_mismatch := FALSE;
  RETURN NEW;
END;
$$;

COMMIT;
