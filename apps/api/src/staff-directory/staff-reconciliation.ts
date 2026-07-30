import { Pool } from 'pg';

type CountRow = {
  staff_total: string;
  staff_without_user: string;
  staff_missing_identity: string;
  linked_staff_without_active_membership: string;
  staff_role_users_without_staff: string;
  duplicate_active_staff_codes: string;
  duplicate_active_staff_emails: string;
  payroll_profiles_total: string;
  payroll_profiles_without_staff: string;
  teacher_assignments_without_staff: string;
  active_teachers_without_assignments: string;
};

export type StaffReconciliationIssue = {
  code: string;
  count: number;
};

export type StaffReconciliationReport = {
  event: 'staff_directory_reconciliation';
  generatedAt: string;
  metrics: {
    staffTotal: number;
    staffWithoutUser: number;
    payrollProfilesTotal: number;
  };
  blockers: StaffReconciliationIssue[];
  warnings: StaffReconciliationIssue[];
  ready: boolean;
};

const REPORT_SQL = `
  SELECT
    (
      SELECT COUNT(*)::text
      FROM school_staff_accounts
      WHERE deleted_at IS NULL
    ) AS staff_total,
    (
      SELECT COUNT(*)::text
      FROM school_staff_accounts
      WHERE deleted_at IS NULL
        AND user_id IS NULL
    ) AS staff_without_user,
    (
      SELECT COUNT(*)::text
      FROM school_staff_accounts
      WHERE deleted_at IS NULL
        AND first_name IS NULL
        AND last_name IS NULL
        AND email_normalized IS NULL
    ) AS staff_missing_identity,
    (
      SELECT COUNT(*)::text
      FROM school_staff_accounts staff
      WHERE staff.deleted_at IS NULL
        AND staff.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM school_memberships membership
          WHERE membership.school_id = staff.school_id
            AND membership.user_id = staff.user_id
            AND membership.membership_status = 'ACTIVE'
            AND membership.deleted_at IS NULL
        )
    ) AS linked_staff_without_active_membership,
    (
      SELECT COUNT(DISTINCT (membership.school_id, membership.user_id))::text
      FROM school_memberships membership
      JOIN school_membership_roles role
        ON role.school_membership_id = membership.id
       AND role.deleted_at IS NULL
      WHERE membership.deleted_at IS NULL
        AND role.role::text IN (
          'SCHOOL_ADMIN',
          'TEACHER',
          'FINANCE_ADMIN'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM school_staff_accounts staff
          WHERE staff.school_id = membership.school_id
            AND staff.user_id = membership.user_id
            AND staff.deleted_at IS NULL
        )
    ) AS staff_role_users_without_staff,
    (
      SELECT COUNT(*)::text
      FROM (
        SELECT
          school_id,
          UPPER(BTRIM(staff_code))
        FROM school_staff_accounts
        WHERE deleted_at IS NULL
          AND staff_code IS NOT NULL
        GROUP BY
          school_id,
          UPPER(BTRIM(staff_code))
        HAVING COUNT(*) > 1
      ) duplicates
    ) AS duplicate_active_staff_codes,
    (
      SELECT COUNT(*)::text
      FROM (
        SELECT
          school_id,
          email_normalized
        FROM school_staff_accounts
        WHERE deleted_at IS NULL
          AND email_normalized IS NOT NULL
        GROUP BY
          school_id,
          email_normalized
        HAVING COUNT(*) > 1
      ) duplicates
    ) AS duplicate_active_staff_emails,
    (
      SELECT COUNT(*)::text
      FROM payroll_staff_profiles
      WHERE deleted_at IS NULL
    ) AS payroll_profiles_total,
    (
      SELECT COUNT(*)::text
      FROM payroll_staff_profiles
      WHERE deleted_at IS NULL
        AND school_staff_account_id IS NULL
    ) AS payroll_profiles_without_staff,
    (
      SELECT COUNT(*)::text
      FROM teacher_academic_assignments assignment
      WHERE assignment.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM school_staff_accounts staff
          WHERE staff.school_id = assignment.school_id
            AND staff.user_id = assignment.teacher_user_id
            AND staff.deleted_at IS NULL
        )
    ) AS teacher_assignments_without_staff,
    (
      SELECT COUNT(*)::text
      FROM school_staff_accounts staff
      WHERE staff.deleted_at IS NULL
        AND staff.employment_status = 'ACTIVE'
        AND staff.staff_category = 'TEACHING'
        AND (
          staff.user_id IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM teacher_academic_assignments assignment
            WHERE assignment.school_id = staff.school_id
              AND assignment.teacher_user_id = staff.user_id
              AND assignment.assignment_status = 'ACTIVE'
              AND assignment.deleted_at IS NULL
          )
        )
    ) AS active_teachers_without_assignments
`;

function issue(code: string, count: string): StaffReconciliationIssue | null {
  const value = Number(count);
  return value > 0 ? { code, count: value } : null;
}

function issues(
  values: Array<StaffReconciliationIssue | null>,
): StaffReconciliationIssue[] {
  return values.filter(
    (value): value is StaffReconciliationIssue => value !== null,
  );
}

export async function collectStaffReconciliation(
  pool: Pool,
): Promise<StaffReconciliationReport> {
  const result = await pool.query<CountRow>(REPORT_SQL);
  const row = result.rows[0];

  if (!row) {
    throw new Error('Staff reconciliation did not return a result.');
  }

  const blockers = issues([
    issue('STAFF_MISSING_IDENTITY', row.staff_missing_identity),
    issue('DUPLICATE_ACTIVE_STAFF_CODES', row.duplicate_active_staff_codes),
    issue('DUPLICATE_ACTIVE_STAFF_EMAILS', row.duplicate_active_staff_emails),
    issue('STAFF_ROLE_USERS_WITHOUT_STAFF', row.staff_role_users_without_staff),
    issue(
      'TEACHER_ASSIGNMENTS_WITHOUT_STAFF',
      row.teacher_assignments_without_staff,
    ),
  ]);
  const warnings = issues([
    issue(
      'LINKED_STAFF_WITHOUT_ACTIVE_MEMBERSHIP',
      row.linked_staff_without_active_membership,
    ),
    issue(
      'PAYROLL_PROFILES_WITHOUT_STAFF',
      row.payroll_profiles_without_staff,
    ),
    issue(
      'ACTIVE_TEACHERS_WITHOUT_ASSIGNMENTS',
      row.active_teachers_without_assignments,
    ),
  ]);

  return {
    event: 'staff_directory_reconciliation',
    generatedAt: new Date().toISOString(),
    metrics: {
      staffTotal: Number(row.staff_total),
      staffWithoutUser: Number(row.staff_without_user),
      payrollProfilesTotal: Number(row.payroll_profiles_total),
    },
    blockers,
    warnings,
    ready: blockers.length === 0,
  };
}
