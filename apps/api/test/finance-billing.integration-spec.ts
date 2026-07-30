import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('controlled finance billing integration', () => {
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

  async function fixture(studentCount = 2) {
    const schoolId = await factory.school();
    const administrator = await factory.user();
    await factory.membership(schoolId, administrator.id, 'SCHOOL_ADMIN');
    const scope = await factory.academicScope(schoolId);
    const studentIds: string[] = [];
    for (let index = 0; index < studentCount; index += 1) {
      const studentId = await factory.student(schoolId);
      await factory.enrollment(studentId, scope);
      studentIds.push(studentId);
    }
    const plan = await harness.billing.createPlan(
      {
        schoolId,
        academicYearId: scope.academicYearId,
        gradeLevelId: scope.gradeLevelId,
        planCode: 'TUITION-M01',
        nameI18n: {
          fr: 'Scolarité mensuelle',
          en: 'Monthly tuition',
        },
        feeType: 'TUITION',
        billingFrequency: 'MONTHLY',
        defaultAmount: 2500,
        currencyCode: 'HTG',
        defaultDueDays: 10,
      },
      administrator.id,
      null,
    );
    return { schoolId, administrator, scope, studentIds, plan };
  }

  it('previews and generates a repeatable billing run without duplicate charges', async () => {
    const value = await fixture();
    const request = {
      schoolId: value.schoolId,
      feePlanId: value.plan.id,
      billingPeriodCode: '2026-09',
      issueDate: '2026-09-01',
      invoiceStatus: 'ISSUED' as const,
    };

    const preview = await harness.billing.preview(request);
    expect(preview).toMatchObject({
      billingPeriodCode: '2026-09',
      dueDate: '2026-09-11',
      summary: {
        candidateCount: 2,
        generatedCount: 2,
        skippedDuplicateCount: 0,
        totalAmount: 5000,
        currencyCode: 'HTG',
      },
    });

    const run = await harness.billing.createRun(
      request,
      value.administrator.id,
      null,
      'billing-run-september-001',
    );
    expect(run).toMatchObject({
      generatedCount: 2,
      skippedDuplicateCount: 0,
      totalGeneratedAmount: 5000,
    });
    expect(run.generatedInvoices).toHaveLength(2);

    await expect(
      harness.billing.createRun(
        request,
        value.administrator.id,
        null,
        'billing-run-september-001',
      ),
    ).resolves.toEqual(run);

    const lateStudentId = await factory.student(value.schoolId);
    await factory.enrollment(lateStudentId, value.scope);

    const catchUp = await harness.billing.createRun(
      request,
      value.administrator.id,
      null,
      'billing-run-september-002',
    );
    expect(catchUp).toMatchObject({
      candidateCount: 3,
      generatedCount: 1,
      skippedDuplicateCount: 2,
      totalGeneratedAmount: 2500,
    });

    const invoices = await pool.query<{
      invoice_count: string;
      item_count: string;
    }>(
      `
      SELECT
        COUNT(DISTINCT invoice.id)::text AS invoice_count,
        COUNT(item.id)::text AS item_count
      FROM invoices invoice
      JOIN invoice_items item ON item.invoice_id = invoice.id
      WHERE invoice.billing_run_id = $1
        AND invoice.fee_plan_id = $2
        AND invoice.deleted_at IS NULL
      `,
      [run.id, value.plan.id],
    );
    expect(invoices.rows[0]).toEqual({
      invoice_count: '2',
      item_count: '2',
    });
  });

  it('serializes concurrent runs and charges each student only once', async () => {
    const value = await fixture(1);
    const request = {
      schoolId: value.schoolId,
      feePlanId: value.plan.id,
      billingPeriodCode: '2026-10',
      issueDate: '2026-10-01',
      invoiceStatus: 'ISSUED' as const,
    };
    const runs = await Promise.all([
      harness.billing.createRun(
        request,
        value.administrator.id,
        null,
        'billing-concurrent-key-001',
      ),
      harness.billing.createRun(
        request,
        value.administrator.id,
        null,
        'billing-concurrent-key-002',
      ),
    ]);
    expect(runs.map((run) => run.generatedCount).sort()).toEqual([0, 1]);
    const chargeCount = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM finance_billing_run_items
      WHERE school_id = $1
        AND student_id = $2
        AND fee_plan_id = $3
        AND billing_period_code = '2026-10'
        AND item_status = 'GENERATED'
      `,
      [value.schoolId, value.studentIds[0], value.plan.id],
    );
    expect(chargeCount.rows[0].count).toBe('1');
  });

  it('rejects cross-school students, archived plans, and conflicting idempotency reuse', async () => {
    const value = await fixture(1);
    const otherSchoolId = await factory.school();
    const otherStudentId = await factory.student(otherSchoolId);
    const request = {
      schoolId: value.schoolId,
      feePlanId: value.plan.id,
      billingPeriodCode: '2026-11',
      issueDate: '2026-11-01',
      studentIds: [otherStudentId],
    };

    await expect(harness.billing.preview(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const validRequest = {
      ...request,
      studentIds: value.studentIds,
    };
    await harness.billing.createRun(
      validRequest,
      value.administrator.id,
      null,
      'billing-idempotency-conflict',
    );
    await expect(
      harness.billing.createRun(
        { ...validRequest, billingPeriodCode: '2026-12' },
        value.administrator.id,
        null,
        'billing-idempotency-conflict',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await harness.billing.updatePlanStatus(
      value.plan.id,
      { schoolId: value.schoolId, isActive: false },
      value.administrator.id,
      null,
    );
    await expect(
      harness.billing.preview({
        ...validRequest,
        billingPeriodCode: '2027-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
