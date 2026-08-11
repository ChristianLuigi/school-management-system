BEGIN;

/*
 * Payroll profiles created before the staff directory could exist without a
 * canonical staff account. Preserve those profiles as offline staff records;
 * login access remains optional and is not created by this migration.
 */
CREATE TEMP TABLE legacy_payroll_staff_reconciliation (
  payroll_staff_profile_id UUID PRIMARY KEY,
  school_id UUID NOT NULL,
  staff_account_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  canonical_staff_code TEXT NOT NULL,
  effective_from DATE NOT NULL
) ON COMMIT DROP;

INSERT INTO legacy_payroll_staff_reconciliation (
  payroll_staff_profile_id,
  school_id,
  staff_account_id,
  actor_user_id,
  canonical_staff_code,
  effective_from
)
SELECT
  profile.id,
  profile.school_id,
  gen_random_uuid(),
  COALESCE(
    profile.created_by_user_id,
    (
      SELECT membership.user_id
      FROM school_memberships membership
      JOIN school_membership_roles membership_role
        ON membership_role.school_membership_id = membership.id
       AND membership_role.deleted_at IS NULL
      WHERE membership.school_id = profile.school_id
        AND membership.membership_status = 'ACTIVE'
        AND membership.deleted_at IS NULL
        AND membership_role.role::TEXT = 'SCHOOL_ADMIN'
      ORDER BY membership.created_at ASC, membership.id ASC
      LIMIT 1
    )
  ),
  CASE
    WHEN NULLIF(BTRIM(profile.staff_code), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM school_staff_accounts existing_staff
        WHERE existing_staff.school_id = profile.school_id
          AND UPPER(existing_staff.staff_code) =
            UPPER(BTRIM(profile.staff_code))
          AND existing_staff.deleted_at IS NULL
      )
      AND 1 = (
        SELECT COUNT(*)
        FROM payroll_staff_profiles peer_profile
        WHERE peer_profile.school_id = profile.school_id
          AND UPPER(BTRIM(peer_profile.staff_code)) =
            UPPER(BTRIM(profile.staff_code))
          AND peer_profile.school_staff_account_id IS NULL
          AND peer_profile.deleted_at IS NULL
      )
      THEN UPPER(BTRIM(profile.staff_code))
    ELSE 'LEGACY-PAY-' || REPLACE(profile.id::TEXT, '-', '')
  END,
  COALESCE(
    profile.salary_effective_from,
    (
      SELECT MIN(run.period_start)
      FROM payroll_run_items item
      JOIN payroll_runs run
        ON run.id = item.payroll_run_id
       AND run.school_id = item.school_id
      WHERE item.payroll_staff_profile_id = profile.id
        AND item.school_id = profile.school_id
        AND item.deleted_at IS NULL
        AND run.deleted_at IS NULL
    ),
    profile.created_at::DATE
  )
FROM payroll_staff_profiles profile
WHERE profile.school_staff_account_id IS NULL
  AND profile.deleted_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM legacy_payroll_staff_reconciliation reconciliation
    WHERE reconciliation.actor_user_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Legacy payroll profiles require a creator or active School Admin before staff reconciliation.';
  END IF;
END $$;

INSERT INTO school_staff_accounts (
  id,
  school_id,
  user_id,
  staff_code,
  staff_type,
  job_title,
  department,
  employment_status,
  created_by_user_id,
  created_at,
  updated_at,
  first_name,
  staff_category,
  employment_type,
  hire_date,
  status_effective_date,
  status_reason,
  employment_status_changed_at,
  employment_status_changed_by_user_id
)
SELECT
  reconciliation.staff_account_id,
  profile.school_id,
  NULL,
  reconciliation.canonical_staff_code,
  CASE
    WHEN profile.employment_type IN (
      'SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'
    ) THEN profile.employment_type
    ELSE NULL
  END,
  COALESCE(profile.position_title, profile.job_title),
  profile.department,
  CASE WHEN profile.payroll_active THEN 'ACTIVE' ELSE 'ARCHIVED' END,
  reconciliation.actor_user_id,
  profile.created_at,
  profile.updated_at,
  profile.full_name,
  CASE profile.employment_type
    WHEN 'SCHOOL_ADMIN' THEN 'SCHOOL_LEADERSHIP'
    WHEN 'TEACHER' THEN 'TEACHING'
    WHEN 'FINANCE_ADMIN' THEN 'FINANCE'
    ELSE 'OTHER'
  END,
  CASE
    WHEN profile.employment_type IN (
      'FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'VOLUNTEER'
    ) THEN profile.employment_type
    ELSE 'FULL_TIME'
  END,
  reconciliation.effective_from,
  reconciliation.effective_from,
  'Imported from a legacy payroll profile.',
  profile.created_at,
  reconciliation.actor_user_id
FROM legacy_payroll_staff_reconciliation reconciliation
JOIN payroll_staff_profiles profile
  ON profile.id = reconciliation.payroll_staff_profile_id
 AND profile.school_id = reconciliation.school_id;

UPDATE payroll_staff_profiles profile
SET
  school_staff_account_id = reconciliation.staff_account_id,
  salary_effective_from = COALESCE(
    profile.salary_effective_from,
    reconciliation.effective_from
  ),
  updated_at = NOW()
FROM legacy_payroll_staff_reconciliation reconciliation
WHERE profile.id = reconciliation.payroll_staff_profile_id
  AND profile.school_id = reconciliation.school_id
  AND profile.school_staff_account_id IS NULL;

INSERT INTO payroll_compensation_versions (
  school_id,
  payroll_staff_profile_id,
  staff_account_id,
  effective_from,
  compensation_type,
  base_amount,
  currency_code,
  pay_frequency,
  standard_allowances,
  standard_deductions,
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
  '[]'::JSONB,
  '[]'::JSONB,
  'Imported legacy payroll compensation after staff reconciliation.',
  reconciliation.actor_user_id,
  reconciliation.actor_user_id,
  profile.created_at
FROM legacy_payroll_staff_reconciliation reconciliation
JOIN payroll_staff_profiles profile
  ON profile.id = reconciliation.payroll_staff_profile_id
 AND profile.school_id = reconciliation.school_id
WHERE NOT EXISTS (
  SELECT 1
  FROM payroll_compensation_versions existing_version
  WHERE existing_version.school_id = profile.school_id
    AND existing_version.payroll_staff_profile_id = profile.id
)
ON CONFLICT (
  school_id,
  payroll_staff_profile_id,
  effective_from
)
DO NOTHING;

/*
 * Existing reviewed/paid items are immutable during normal operation. The
 * migration temporarily disables only the two guards that protect the
 * reference columns, then backfills references without changing money or
 * descriptive snapshot values.
 */
ALTER TABLE payroll_run_items
  DISABLE TRIGGER trg_payroll_guard_item_mutation;

ALTER TABLE payroll_run_items
  DISABLE TRIGGER trg_zz_payroll_compensation_item_reference_immutable;

WITH item_references AS (
  SELECT
    item.id AS payroll_run_item_id,
    profile.school_staff_account_id,
    selected_version.id AS compensation_version_id,
    selected_version.compensation_type
  FROM payroll_run_items item
  JOIN payroll_staff_profiles profile
    ON profile.id = item.payroll_staff_profile_id
   AND profile.school_id = item.school_id
  JOIN payroll_runs run
    ON run.id = item.payroll_run_id
   AND run.school_id = item.school_id
  CROSS JOIN LATERAL (
    SELECT version.id, version.compensation_type
    FROM payroll_compensation_versions version
    WHERE version.school_id = item.school_id
      AND version.payroll_staff_profile_id = item.payroll_staff_profile_id
    ORDER BY
      CASE WHEN version.effective_from <= run.period_start THEN 0 ELSE 1 END,
      CASE WHEN version.effective_from <= run.period_start
        THEN version.effective_from END DESC,
      version.effective_from ASC,
      version.created_at ASC
    LIMIT 1
  ) selected_version
  WHERE item.deleted_at IS NULL
    AND (
      item.staff_account_id IS NULL
      OR item.compensation_version_id IS NULL
    )
)
UPDATE payroll_run_items item
SET
  staff_account_id = item_references.school_staff_account_id,
  compensation_version_id = item_references.compensation_version_id,
  snapshot_compensation_type = item_references.compensation_type,
  updated_at = NOW()
FROM item_references
WHERE item.id = item_references.payroll_run_item_id;

ALTER TABLE payroll_run_items
  ENABLE TRIGGER trg_zz_payroll_compensation_item_reference_immutable;

ALTER TABLE payroll_run_items
  ENABLE TRIGGER trg_payroll_guard_item_mutation;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payroll_staff_profiles profile
    WHERE profile.deleted_at IS NULL
      AND profile.school_staff_account_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Payroll staff reconciliation left one or more profiles without a staff account.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM payroll_staff_profiles profile
    WHERE profile.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM payroll_compensation_versions version
        WHERE version.school_id = profile.school_id
          AND version.payroll_staff_profile_id = profile.id
      )
  ) THEN
    RAISE EXCEPTION
      'Payroll staff reconciliation left one or more profiles without compensation history.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM payroll_run_items item
    WHERE item.deleted_at IS NULL
      AND (
        item.staff_account_id IS NULL
        OR item.compensation_version_id IS NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Payroll staff reconciliation left one or more payroll items without canonical references.';
  END IF;
END $$;

COMMIT;
