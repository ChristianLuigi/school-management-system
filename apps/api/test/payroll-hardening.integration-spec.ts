import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('payroll hardening integration', () => {
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

  beforeEach(async () => {
    await resetIntegrationDatabase(pool);
  });

  afterAll(async () => {
    await harness.close();
    await pool.end();
  });

  async function administrator(schoolId: string) {
    const user = await factory.user();
    await factory.membership(schoolId, user.id, 'SCHOOL_ADMIN');
    return user;
  }

  async function linkedPayrollProfile(input?: {
    schoolId?: string;
    actorUserId?: string;
    currencyCode?: string;
    baseSalary?: number;
    employmentStatus?:
      | 'ACTIVE'
      | 'ON_LEAVE'
      | 'SUSPENDED'
      | 'TERMINATED'
      | 'ARCHIVED';
    firstName?: string;
    lastName?: string;
  }) {
    const schoolId = input?.schoolId ?? (await factory.school());
    const actor = input?.actorUserId
      ? { id: input.actorUserId }
      : await administrator(schoolId);
    const staffUser = await factory.user();
    await factory.membership(schoolId, staffUser.id, 'TEACHER');
    await pool.query(
      `
      UPDATE users
      SET first_name = $2, last_name = $3
      WHERE id = $1
      `,
      [staffUser.id, input?.firstName ?? 'Marie', input?.lastName ?? 'Payroll'],
    );
    const staffAccountId = await factory.schoolStaffAccount(
      schoolId,
      staffUser.id,
      {
        staffType: 'TEACHER',
        employmentStatus: input?.employmentStatus ?? 'ACTIVE',
        jobTitle: 'Mathematics Teacher',
        department: 'Academics',
        createdByUserId: actor.id,
      },
    );
    await pool.query(
      `
      UPDATE school_staff_accounts
      SET first_name = $2, last_name = $3, hire_date = '2026-01-01', updated_at = NOW()
      WHERE id = $1
      `,
      [staffAccountId, input?.firstName ?? 'Marie', input?.lastName ?? 'Payroll'],
    );
    const profile = await harness.payroll.createPayrollProfile(
      {
        schoolId,
        staffAccountId,
        baseSalary: input?.baseSalary ?? 1000,
        currencyCode: input?.currencyCode ?? 'HTG',
        effectiveFrom: '2026-01-01',
      },
      actor.id,
      null,
    );
    return {
      schoolId,
      actor,
      staffUser,
      staffAccountId,
      profile,
    };
  }

  async function draftRun(input: {
    schoolId: string;
    actorUserId: string;
    suffix: string;
    currencyCode?: string;
  }) {
    return harness.payroll.createPayrollRun(
      {
        schoolId: input.schoolId,
        periodLabel: `Payroll ${input.suffix}`,
        periodStart: `2026-${input.suffix}-01`,
        periodEnd: `2026-${input.suffix}-28`,
        currencyCode: input.currencyCode ?? 'HTG',
      },
      input.actorUserId,
      null,
    );
  }

  it('requires an active linked staff account from the same school', async () => {
    const schoolId = await factory.school();
    const otherSchoolId = await factory.school();
    const admin = await administrator(schoolId);
    const staffUser = await factory.user();
    await factory.membership(otherSchoolId, staffUser.id, 'TEACHER');
    const foreignAccountId = await factory.schoolStaffAccount(
      otherSchoolId,
      staffUser.id,
      { createdByUserId: admin.id },
    );

    await expect(
      harness.payroll.createPayrollProfile(
        {
          schoolId,
          baseSalary: 1000,
          currencyCode: 'HTG',
        } as never,
        admin.id,
        null,
      ),
    ).rejects.toThrow(/staff account/i);

    await expect(
      harness.payroll.createPayrollProfile(
        {
          schoolId,
          staffAccountId: foreignAccountId,
          baseSalary: 1000,
          currencyCode: 'HTG',
        },
        admin.id,
        null,
      ),
    ).rejects.toThrow(/staff account|school/i);

    const inactiveUser = await factory.user();
    await factory.membership(schoolId, inactiveUser.id, 'TEACHER');
    const inactiveAccountId = await factory.schoolStaffAccount(
      schoolId,
      inactiveUser.id,
      {
        employmentStatus: 'SUSPENDED',
        createdByUserId: admin.id,
      },
    );
    await expect(
      harness.payroll.createPayrollProfile(
        {
          schoolId,
          staffAccountId: inactiveAccountId,
          baseSalary: 1000,
          currencyCode: 'HTG',
        },
        admin.id,
        null,
      ),
    ).rejects.toThrow(/active|suspended|staff account/i);

    const validUser = await factory.user();
    await factory.membership(schoolId, validUser.id, 'TEACHER');
    const validAccountId = await factory.schoolStaffAccount(
      schoolId,
      validUser.id,
      { createdByUserId: admin.id },
    );
    await expect(
      harness.payroll.createPayrollProfile(
        {
          schoolId,
          staffAccountId: validAccountId,
          baseSalary: 1000,
          currencyCode: 'HTG',
        },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({
      staffAccountId: validAccountId,
      currencyCode: 'HTG',
    });
  });

  it('creates one-currency runs and serializes duplicate payroll periods', async () => {
    const fixture = await linkedPayrollProfile();
    const dollarProfile = await linkedPayrollProfile({
      schoolId: fixture.schoolId,
      actorUserId: fixture.actor.id,
      currencyCode: 'USD',
      baseSalary: 25,
      firstName: 'Jean',
      lastName: 'Dollar',
    });
    const request = {
      schoolId: fixture.schoolId,
      periodLabel: 'October 2026 payroll',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      currencyCode: 'HTG',
    };
    await expect(
      harness.payroll.createPayrollRun(request, fixture.actor.id, null),
    ).rejects.toThrow(/currency/i);
    await pool.query(
      `
      UPDATE payroll_staff_profiles
      SET payroll_active = FALSE, updated_at = NOW()
      WHERE id = $1
      `,
      [dollarProfile.profile.id],
    );

    const attempts = await Promise.allSettled([
      harness.payroll.createPayrollRun(request, fixture.actor.id, null),
      harness.payroll.createPayrollRun(request, fixture.actor.id, null),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === 'rejected'),
    ).toHaveLength(1);

    const fulfilled = attempts.find(
      (attempt) => attempt.status === 'fulfilled',
    );
    if (!fulfilled || fulfilled.status !== 'fulfilled') {
      throw new Error('A payroll run should have been created.');
    }
    const run = fulfilled.value;
    expect(run).toMatchObject({ staffCount: 1 });
    const persisted = await pool.query<{
      item_count: string;
      currency_codes: string[];
    }>(
      `
      SELECT
        COUNT(*)::text AS item_count,
        ARRAY_AGG(DISTINCT currency_code) AS currency_codes
      FROM payroll_run_items
      WHERE payroll_run_id = $1
        AND deleted_at IS NULL
      `,
      [run?.id],
    );
    expect(persisted.rows[0]).toEqual({
      item_count: '1',
      currency_codes: ['HTG'],
    });
  });

  it('snapshots salary and staff identity when the run is generated', async () => {
    const fixture = await linkedPayrollProfile();
    const run = await draftRun({
      schoolId: fixture.schoolId,
      actorUserId: fixture.actor.id,
      suffix: '09',
    });
    const original = await pool.query<{
      snapshot_full_name: string;
      snapshot_staff_code: string | null;
      snapshot_position_title: string | null;
      snapshot_department: string | null;
      snapshot_base_salary: string;
      currency_code: string;
    }>(
      `
      SELECT
        snapshot_full_name,
        snapshot_staff_code,
        snapshot_position_title,
        snapshot_department,
        snapshot_base_salary::text,
        currency_code
      FROM payroll_run_items
      WHERE payroll_run_id = $1
      `,
      [run.id],
    );
    expect(original.rows[0]).toMatchObject({
      snapshot_full_name: 'Marie Payroll',
      snapshot_position_title: 'Mathematics Teacher',
      snapshot_department: 'Academics',
      snapshot_base_salary: '1000.00',
      currency_code: 'HTG',
    });

    await pool.query(
      `
      UPDATE users
      SET first_name = 'Changed', last_name = 'Employee'
      WHERE id = $1
      `,
      [fixture.staffUser.id],
    );
    await pool.query(
      `
      UPDATE school_staff_accounts
      SET staff_code = 'CHANGED-001', job_title = 'Changed Role', department = 'Changed'
      WHERE id = $1
      `,
      [fixture.staffAccountId],
    );
    await pool.query(
      `
      UPDATE payroll_staff_profiles
      SET base_salary = 9999, updated_at = NOW()
      WHERE id = $1
      `,
      [fixture.profile.id],
    );

    const afterChange = await pool.query(
      `
      SELECT
        snapshot_full_name,
        snapshot_staff_code,
        snapshot_position_title,
        snapshot_department,
        snapshot_base_salary::text,
        currency_code
      FROM payroll_run_items
      WHERE payroll_run_id = $1
      `,
      [run.id],
    );
    expect(afterChange.rows[0]).toEqual(original.rows[0]);
  });

  it('enforces lifecycle, separation of duties, adjustments, processing, and closed locking', async () => {
    const fixture = await linkedPayrollProfile();
    const approver = await administrator(fixture.schoolId);
    const run = await draftRun({
      schoolId: fixture.schoolId,
      actorUserId: fixture.actor.id,
      suffix: '08',
    });
    const draft = await harness.payroll.getPayrollRunDetails(
      { schoolId: fixture.schoolId, payrollRunId: run.id },
      fixture.actor.id,
      null,
    );
    const itemId = draft.items[0].id;

    const adjusted = await harness.payroll.updatePayrollItemAdjustments(
      itemId,
      {
        schoolId: fixture.schoolId,
        reason: 'Contractual monthly payroll adjustments.',
        allowances: [
          {
            code: 'TRANSPORT',
            description: 'Transport allowance',
            amount: 100,
          },
        ],
        deductions: [
          { code: 'TAX', description: 'Payroll deduction', amount: 50 },
        ],
      },
      fixture.actor.id,
      null,
    );
    expect(adjusted).toMatchObject({
      item: {
        grossSalary: 1000,
        allowances: 100,
        deductions: 50,
        netSalary: 1050,
      },
      runTotals: {
        totalGross: 1000,
        totalAllowances: 100,
        totalDeductions: 50,
        totalNet: 1050,
      },
    });

    await expect(
      harness.payroll.markPayrollItemPaid(
        itemId,
        {
          schoolId: fixture.schoolId,
          paymentMethod: 'BANK_TRANSFER',
          paymentReference: 'PAYROLL-2026-08-001',
        },
        fixture.actor.id,
        null,
      ),
    ).rejects.toThrow(/processing/i);
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId: fixture.schoolId, targetStatus: 'APPROVED' },
        approver.id,
        null,
      ),
    ).rejects.toThrow(/cannot move|transition|reviewed/i);

    await harness.payroll.updatePayrollRunStatus(
      run.id,
      { schoolId: fixture.schoolId, targetStatus: 'UNDER_REVIEW' },
      fixture.actor.id,
      null,
    );
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      { schoolId: fixture.schoolId, targetStatus: 'PENDING_APPROVAL' },
      approver.id,
      null,
    );
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        {
          schoolId: fixture.schoolId,
          targetStatus: 'APPROVED',
          note: 'Attempted self approval with another operator available.',
        },
        fixture.actor.id,
        null,
      ),
    ).rejects.toThrow(/preparer|approver|different/i);
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId: fixture.schoolId,
        targetStatus: 'APPROVED',
        note: 'Independently checked against staff salary records.',
      },
      approver.id,
      null,
    );
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      { schoolId: fixture.schoolId, targetStatus: 'PROCESSING' },
      fixture.actor.id,
      null,
    );
    const paid = await harness.payroll.markPayrollItemPaid(
      itemId,
      {
        schoolId: fixture.schoolId,
        paymentMethod: 'BANK_TRANSFER',
        paymentReference: 'PAYROLL-2026-08-001',
      },
      fixture.actor.id,
      null,
    );
    expect(paid).toMatchObject({
      paymentStatus: 'PAID',
      payrollRunFullyPaid: true,
    });
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId: fixture.schoolId,
        targetStatus: 'CLOSED',
        note: 'Payments verified and payroll register archived.',
      },
      approver.id,
      null,
    );

    await expect(
      harness.payroll.updatePayrollItemAdjustments(
        itemId,
        {
          schoolId: fixture.schoolId,
          reason: 'Attempted late change after closing.',
          allowances: [],
          deductions: [],
        },
        fixture.actor.id,
        null,
      ),
    ).rejects.toThrow(/closed|draft/i);
    await expect(
      harness.payroll.reversePayrollItemPayment(
        itemId,
        {
          schoolId: fixture.schoolId,
          reason: 'Attempted reversal after payroll was closed.',
        },
        fixture.actor.id,
        null,
      ),
    ).rejects.toThrow(/closed/i);
    await expect(
      pool.query(`UPDATE payroll_runs SET notes = 'mutated' WHERE id = $1`, [
        run.id,
      ]),
    ).rejects.toThrow(/closed payroll runs are locked/i);

    await pool.query(
      `
      UPDATE users
      SET first_name = 'Changed', last_name = 'Employee'
      WHERE id = $1
      `,
      [fixture.staffUser.id],
    );
    const register = await harness.payroll.getPayrollPaymentRegister(
      { schoolId: fixture.schoolId, payrollRunId: run.id },
      fixture.actor.id,
      null,
    );
    const serializedRegister = JSON.stringify(register);
    expect(serializedRegister).toContain('Marie Payroll');
    expect(serializedRegister).not.toContain('Changed Employee');
    expect(serializedRegister).toContain('1050');
  });

  it('requires an audited override for a sole preparer-approver and supports payment reversal', async () => {
    const fixture = await linkedPayrollProfile();
    const run = await draftRun({
      schoolId: fixture.schoolId,
      actorUserId: fixture.actor.id,
      suffix: '07',
    });
    const details = await harness.payroll.getPayrollRunDetails(
      { schoolId: fixture.schoolId, payrollRunId: run.id },
      fixture.actor.id,
      null,
    );
    const itemId = details.items[0].id;
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      { schoolId: fixture.schoolId, targetStatus: 'UNDER_REVIEW' },
      fixture.actor.id,
      null,
    );
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId: fixture.schoolId,
        targetStatus: 'PENDING_APPROVAL',
        note: 'Only one authorized payroll reviewer is available.',
      },
      fixture.actor.id,
      null,
    );
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId: fixture.schoolId, targetStatus: 'APPROVED' },
        fixture.actor.id,
        null,
      ),
    ).rejects.toThrow(/note|override|reason/i);
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId: fixture.schoolId,
        targetStatus: 'APPROVED',
        note: 'Only one authorized payroll operator is available.',
      },
      fixture.actor.id,
      null,
    );
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      { schoolId: fixture.schoolId, targetStatus: 'PROCESSING' },
      fixture.actor.id,
      null,
    );
    await harness.payroll.markPayrollItemPaid(
      itemId,
      {
        schoolId: fixture.schoolId,
        paymentMethod: 'CASH',
        paymentReference: 'SOLE-OPERATOR-PAYMENT',
      },
      fixture.actor.id,
      null,
    );
    const reversed = await harness.payroll.reversePayrollItemPayment(
      itemId,
      {
        schoolId: fixture.schoolId,
        reason: 'The original payment destination was incorrect.',
      },
      fixture.actor.id,
      null,
    );
    expect(reversed).toMatchObject({
      paymentStatus: 'REVERSED',
      payrollRunStatus: 'PROCESSING',
    });
    await expect(
      harness.payroll.reversePayrollItemPayment(
        itemId,
        {
          schoolId: fixture.schoolId,
          reason: 'A duplicate reversal must never be accepted.',
        },
        fixture.actor.id,
        null,
      ),
    ).rejects.toThrow(/paid|already|reverse/i);

    const persisted = await pool.query<{
      reversal_count: string;
      change_count: string;
      override_reason: string | null;
    }>(
      `
      SELECT
        (SELECT COUNT(*)::text FROM payroll_payment_reversals WHERE payroll_run_item_id = $1) AS reversal_count,
        (SELECT COUNT(*)::text FROM payroll_item_change_log WHERE payroll_run_item_id = $1 AND change_type = 'PAYMENT_REVERSED') AS change_count,
        (SELECT separation_override_reason FROM payroll_runs WHERE id = $2) AS override_reason
      `,
      [itemId, run.id],
    );
    expect(persisted.rows[0]).toMatchObject({
      reversal_count: '1',
      change_count: '1',
      override_reason: 'Only one authorized payroll operator is available.',
    });
  });
});
