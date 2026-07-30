import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { collectStaffReconciliation } from '../src/staff-directory/staff-reconciliation';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';

describe('staff directory foundation integration', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createIntegrationPool();
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function school() {
    const id = randomUUID();
    await pool.query(
      `
      INSERT INTO schools (
        id,
        code,
        name,
        currency_code,
        country_code,
        timezone,
        status,
        management_mode
      )
      VALUES (
        $1,
        $2,
        'Staff Foundation School',
        'HTG',
        'HT',
        'America/Port-au-Prince',
        'ACTIVE',
        'SELF_MANAGED'
      )
      `,
      [id, `STAFF-${id.slice(0, 8)}`],
    );
    return id;
  }

  async function user() {
    const id = randomUUID();
    const email = `staff-${id.slice(0, 12)}@integration.test`;
    await pool.query(
      `
      INSERT INTO users (
        id,
        email,
        email_original,
        email_normalized,
        password_hash,
        preferred_locale,
        status,
        account_status,
        first_name,
        last_name
      )
      VALUES (
        $1,
        $2::text,
        $2::text,
        $2::text,
        'INTEGRATION_TEST_DISABLED_PASSWORD',
        'fr',
        'ACTIVE',
        'ACTIVE',
        'Linked',
        'Employee'
      )
      `,
      [id, email],
    );
    return { id, email };
  }

  it('creates and normalizes a staff record without a login account', async () => {
    const schoolId = await school();
    const result = await pool.query<{
      id: string;
      user_id: string | null;
      staff_code: string;
      first_name: string;
      last_name: string;
      email_original: string;
      email_normalized: string;
      staff_type: string | null;
      staff_category: string;
      employment_type: string;
      hire_date: string;
      row_version: number;
    }>(
      `
      INSERT INTO school_staff_accounts (
        school_id,
        staff_code,
        first_name,
        last_name,
        email_original,
        staff_category,
        employment_type,
        employment_status
      )
      VALUES (
        $1,
        ' support-001 ',
        '  Ana ',
        ' Pierre  ',
        ' ANA.PIERRE@EXAMPLE.TEST ',
        'SUPPORT',
        'PART_TIME',
        'ACTIVE'
      )
      RETURNING
        id,
        user_id,
        staff_code,
        first_name,
        last_name,
        email_original,
        email_normalized,
        staff_type,
        staff_category,
        employment_type,
        hire_date::text,
        row_version
      `,
      [schoolId],
    );

    expect(result.rows[0]).toMatchObject({
      user_id: null,
      staff_code: 'SUPPORT-001',
      first_name: 'Ana',
      last_name: 'Pierre',
      email_original: 'ANA.PIERRE@EXAMPLE.TEST',
      email_normalized: 'ana.pierre@example.test',
      staff_type: null,
      staff_category: 'SUPPORT',
      employment_type: 'PART_TIME',
      row_version: 1,
    });
    expect(result.rows[0].hire_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const updated = await pool.query<{ row_version: number }>(
      `
      UPDATE school_staff_accounts
      SET job_title = ' School Operations Assistant '
      WHERE id = $1
      RETURNING row_version
      `,
      [result.rows[0].id],
    );
    expect(updated.rows[0].row_version).toBe(2);
  });

  it('hydrates canonical identity for legacy linked-user inserts', async () => {
    const schoolId = await school();
    const linkedUser = await user();
    const result = await pool.query<{
      first_name: string;
      last_name: string;
      email_normalized: string;
      staff_category: string;
    }>(
      `
      INSERT INTO school_staff_accounts (
        school_id,
        user_id,
        staff_type,
        employment_status
      )
      VALUES ($1, $2, 'TEACHER', 'ACTIVE')
      RETURNING
        first_name,
        last_name,
        email_normalized,
        staff_category
      `,
      [schoolId, linkedUser.id],
    );

    expect(result.rows[0]).toEqual({
      first_name: 'Linked',
      last_name: 'Employee',
      email_normalized: linkedUser.email,
      staff_category: 'TEACHING',
    });
  });

  it('enforces school-scoped codes, email addresses, and supervisors', async () => {
    const firstSchoolId = await school();
    const secondSchoolId = await school();
    const first = await pool.query<{ id: string }>(
      `
      INSERT INTO school_staff_accounts (
        school_id,
        staff_code,
        first_name,
        email_original,
        staff_category,
        employment_status
      )
      VALUES ($1, 'DIR-001', 'First', 'first@example.test', 'ADMINISTRATIVE', 'ACTIVE')
      RETURNING id
      `,
      [firstSchoolId],
    );
    const otherSchool = await pool.query<{ id: string }>(
      `
      INSERT INTO school_staff_accounts (
        school_id,
        staff_code,
        first_name,
        email_original,
        staff_category,
        employment_status
      )
      VALUES ($1, 'DIR-001', 'Other', 'first@example.test', 'ADMINISTRATIVE', 'ACTIVE')
      RETURNING id
      `,
      [secondSchoolId],
    );

    await expect(
      pool.query(
        `
        INSERT INTO school_staff_accounts (
          school_id,
          staff_code,
          first_name,
          staff_category,
          employment_status
        )
        VALUES ($1, ' dir-001 ', 'Duplicate', 'SUPPORT', 'ACTIVE')
        `,
        [firstSchoolId],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      pool.query(
        `
        INSERT INTO school_staff_accounts (
          school_id,
          first_name,
          email_original,
          staff_category,
          employment_status
        )
        VALUES ($1, 'Duplicate Email', ' FIRST@EXAMPLE.TEST ', 'SUPPORT', 'ACTIVE')
        `,
        [firstSchoolId],
      ),
    ).rejects.toMatchObject({ code: '23505' });

    const subordinate = await pool.query<{ id: string }>(
      `
      INSERT INTO school_staff_accounts (
        school_id,
        first_name,
        supervisor_staff_account_id,
        staff_category,
        employment_status
      )
      VALUES ($1, 'Subordinate', $2, 'SUPPORT', 'ACTIVE')
      RETURNING id
      `,
      [firstSchoolId, first.rows[0].id],
    );
    expect(subordinate.rows[0].id).toBeDefined();

    await expect(
      pool.query(
        `
        UPDATE school_staff_accounts
        SET supervisor_staff_account_id = $2
        WHERE id = $1
        `,
        [subordinate.rows[0].id, otherSchool.rows[0].id],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('enforces employment dates and reports warnings without exposing PII', async () => {
    const schoolId = await school();

    await expect(
      pool.query(
        `
        INSERT INTO school_staff_accounts (
          school_id,
          first_name,
          staff_category,
          employment_status,
          hire_date
        )
        VALUES ($1, 'Invalid Termination', 'SUPPORT', 'TERMINATED', '2026-01-01')
        `,
        [schoolId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      pool.query(
        `
        INSERT INTO school_staff_accounts (
          school_id,
          first_name,
          staff_category,
          employment_status,
          hire_date,
          termination_date
        )
        VALUES (
          $1,
          'Invalid Dates',
          'SUPPORT',
          'TERMINATED',
          '2026-02-01',
          '2026-01-31'
        )
        `,
        [schoolId],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await pool.query(
      `
      INSERT INTO school_staff_accounts (
        school_id,
        first_name,
        staff_category,
        employment_status
      )
      VALUES ($1, 'Offline Teacher', 'TEACHING', 'ACTIVE')
      `,
      [schoolId],
    );
    await pool.query(
      `
      INSERT INTO payroll_staff_profiles (
        school_id,
        full_name,
        base_salary,
        currency_code,
        payroll_active
      )
      VALUES ($1, 'Legacy Payroll Profile', 1000, 'HTG', TRUE)
      `,
      [schoolId],
    );

    const report = await collectStaffReconciliation(pool);
    expect(report).toMatchObject({
      event: 'staff_directory_reconciliation',
      metrics: {
        staffTotal: 1,
        staffWithoutUser: 1,
        payrollProfilesTotal: 1,
      },
      blockers: [],
      ready: true,
    });
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        { code: 'PAYROLL_PROFILES_WITHOUT_STAFF', count: 1 },
        { code: 'ACTIVE_TEACHERS_WITHOUT_ASSIGNMENTS', count: 1 },
      ]),
    );
    expect(JSON.stringify(report)).not.toContain('Offline Teacher');
    expect(JSON.stringify(report)).not.toContain('Legacy Payroll Profile');
  });
});
