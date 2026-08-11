import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('effective-dated payroll compensation integration', () => {
  let pool: Pool;
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let factory: IntegrationFactory;

  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    factory = new IntegrationFactory(
      pool,
      harness.passwords,
      harness.sessionTokens,
    );
  });

  beforeEach(async () => resetIntegrationDatabase(pool));

  afterAll(async () => {
    await harness.close();
    await pool.end();
  });

  async function administrator(schoolId: string) {
    const user = await factory.user();
    await factory.membership(schoolId, user.id, 'SCHOOL_ADMIN');
    return user;
  }

  async function offlineStaff(schoolId: string, actorUserId: string) {
    const id = randomUUID();
    await pool.query(
      `
      INSERT INTO school_staff_accounts (
        id,
        school_id,
        user_id,
        staff_code,
        first_name,
        last_name,
        email_original,
        email_normalized,
        staff_type,
        staff_category,
        employment_type,
        employment_status,
        hire_date,
        status_reason,
        created_by_user_id
      )
      VALUES (
        $1,$2,NULL,$3,'Offline','Employee',$4,$4,
        'TEACHER','TEACHING','FULL_TIME','ACTIVE',
        '2025-09-01','Integration payroll fixture.',$5
      )
      `,
      [
        id,
        schoolId,
        `OFF-${id.slice(0, 8)}`,
        `offline-${id.slice(0, 8)}@release.test`,
        actorUserId,
      ],
    );
    return id;
  }

  it('enrolls and pays active staff who do not have login accounts', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const staffAccountId = await offlineStaff(schoolId, admin.id);

    const options = await harness.payroll.listPayrollStaffOptions(
      { schoolId },
      admin.id,
      null,
    );
    expect(options).toContainEqual(
      expect.objectContaining({
        id: staffAccountId,
        userId: null,
        fullName: 'Offline Employee',
        hasPayrollProfile: false,
      }),
    );

    const profile = await harness.payroll.createPayrollProfile(
      {
        schoolId,
        staffAccountId,
        baseSalary: 45_000,
        currencyCode: 'HTG',
        effectiveFrom: '2026-01-01',
        payFrequency: 'MONTHLY',
        compensationType: 'SALARY',
        changeReason: 'Initial employment compensation.',
      },
      admin.id,
      null,
    );
    expect(profile).toMatchObject({
      staffAccountId,
      userId: null,
      baseSalary: 45_000,
      effectiveFrom: '2026-01-01',
    });

    const run = await harness.payroll.createPayrollRun(
      {
        schoolId,
        periodLabel: 'May 2026 payroll',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        currencyCode: 'HTG',
      },
      admin.id,
      null,
    );
    expect(run).toMatchObject({ staffCount: 1, totalGross: 45_000 });
  });

  it('selects the version effective at period start and snapshots standards', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const staffAccountId = await offlineStaff(schoolId, admin.id);
    const profile = await harness.payroll.createPayrollProfile(
      {
        schoolId,
        staffAccountId,
        baseSalary: 40_000,
        currencyCode: 'HTG',
        effectiveFrom: '2026-01-01',
      },
      admin.id,
      null,
    );

    const version = await harness.payroll.createPayrollCompensationVersion(
      profile.id,
      {
        schoolId,
        effectiveFrom: '2026-06-01',
        compensationType: 'SALARY',
        baseAmount: 50_000,
        currencyCode: 'HTG',
        payFrequency: 'MONTHLY',
        standardAllowances: [
          { code: 'TRANSPORT', description: 'Transport', amount: 2_500 },
        ],
        standardDeductions: [
          { code: 'TAX', description: 'Tax withholding', amount: 1_000 },
        ],
        changeReason: 'Approved annual compensation review.',
      },
      admin.id,
      null,
    );

    const may = await harness.payroll.createPayrollRun(
      {
        schoolId,
        periodLabel: 'May 2026 payroll',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        currencyCode: 'HTG',
      },
      admin.id,
      null,
    );
    const june = await harness.payroll.createPayrollRun(
      {
        schoolId,
        periodLabel: 'June 2026 payroll',
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        currencyCode: 'HTG',
      },
      admin.id,
      null,
    );
    expect(may).toMatchObject({
      totalGross: 40_000,
      totalAllowances: 0,
      totalDeductions: 0,
      totalNet: 40_000,
    });
    expect(june).toMatchObject({
      totalGross: 50_000,
      totalAllowances: 2_500,
      totalDeductions: 1_000,
      totalNet: 51_500,
    });

    const item = await pool.query<{
      compensation_version_id: string;
      snapshot_base_salary: string;
      snapshot_compensation_type: string;
    }>(
      `
      SELECT
        compensation_version_id,
        snapshot_base_salary::text,
        snapshot_compensation_type
      FROM payroll_run_items
      WHERE payroll_run_id = $1
      `,
      [june.id],
    );
    expect(item.rows[0]).toEqual({
      compensation_version_id: version.id,
      snapshot_base_salary: '50000.00',
      snapshot_compensation_type: 'SALARY',
    });
    const adjustments = await pool.query<{ adjustment_code: string }>(
      `
      SELECT adjustment_code
      FROM payroll_item_adjustments
      WHERE payroll_run_item_id IN (
        SELECT id FROM payroll_run_items WHERE payroll_run_id = $1
      )
      ORDER BY adjustment_code
      `,
      [june.id],
    );
    expect(adjustments.rows.map((row) => row.adjustment_code)).toEqual([
      'TAX',
      'TRANSPORT',
    ]);
  });

  it('requires a School Administrator and preserves immutable versions', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const staffAccountId = await offlineStaff(schoolId, admin.id);
    const profile = await harness.payroll.createPayrollProfile(
      {
        schoolId,
        staffAccountId,
        baseSalary: 40_000,
        currencyCode: 'HTG',
        effectiveFrom: '2026-01-01',
      },
      admin.id,
      null,
    );
    const financeUser = await factory.user();
    await factory.membership(schoolId, financeUser.id, 'FINANCE_ADMIN');
    await pool.query(
      `
      INSERT INTO school_user_permissions (
        school_id, user_id, permission_code, granted_by_user_id
      )
      VALUES ($1,$2,'PAYROLL_MANAGE',$3)
      `,
      [schoolId, financeUser.id, admin.id],
    );
    const request = {
      schoolId,
      effectiveFrom: '2026-07-01',
      compensationType: 'SALARY' as const,
      baseAmount: 55_000,
      currencyCode: 'HTG',
      payFrequency: 'MONTHLY' as const,
      standardAllowances: [],
      standardDeductions: [],
      changeReason: 'Approved change.',
    };
    await expect(
      harness.payroll.createPayrollCompensationVersion(
        profile.id,
        {
          ...request,
          standardAllowances: [
            { code: 'BONUS', description: 'First bonus', amount: 100 },
            { code: 'bonus', description: 'Duplicate bonus', amount: 200 },
          ],
        },
        admin.id,
        null,
      ),
    ).rejects.toThrow(/duplicate allowance code/i);
    await expect(
      harness.payroll.createPayrollCompensationVersion(
        profile.id,
        request,
        financeUser.id,
        null,
      ),
    ).rejects.toThrow(/School Administrator/i);

    const version = await harness.payroll.createPayrollCompensationVersion(
      profile.id,
      request,
      admin.id,
      null,
    );
    await expect(
      pool.query(
        'UPDATE payroll_compensation_versions SET base_amount = 1 WHERE id = $1',
        [version.id],
      ),
    ).rejects.toThrow(/immutable/i);
    await expect(
      harness.payroll.createPayrollCompensationVersion(
        profile.id,
        request,
        admin.id,
        null,
      ),
    ).rejects.toThrow(/effective date|already exists/i);
  });
});
