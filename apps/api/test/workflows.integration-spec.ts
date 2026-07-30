import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('representative school workflows integration', () => {
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

  it('records attendance and grade scores using real operational tables', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const scope = await factory.academicScope(schoolId);
    const studentId = await factory.student(schoolId);
    await factory.enrollment(studentId, scope);

    const attendance = await harness.attendance.submitAttendanceSession(
      {
        schoolId,
        sectionId: scope.sectionId,
        attendanceDate: '2026-10-05',
        slot: 'MORNING',
        records: [{ studentId, status: 'PRESENT' }],
      },
      admin.id,
      null,
    );
    expect(attendance).toMatchObject({
      schoolId,
      sectionId: scope.sectionId,
      counts: { PRESENT: 1 },
    });

    const assessment = await harness.gradebooks.createAssessment(
      {
        schoolId,
        sectionId: scope.sectionId,
        subjectId: scope.subjectId,
        title: 'Release readiness assessment',
        assessmentType: 'QUIZ',
        assessmentDate: '2026-10-06',
        maxPoints: 20,
        weightPercent: 100,
      },
      admin.id,
      null,
    );
    await expect(
      harness.gradebooks.saveScores(
        {
          schoolId,
          assessmentId: assessment.id,
          scores: [{ studentId, score: 17, note: 'Verified workflow' }],
        },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({
      assessmentId: assessment.id,
      scoreCount: 1,
    });

    const persisted = await pool.query<{
      attendance_count: string;
      score: string;
    }>(
      `
      SELECT
        (SELECT COUNT(*)::text FROM attendance_records WHERE student_id = $1) AS attendance_count,
        (SELECT score::text FROM gradebook_scores WHERE student_id = $1 AND assessment_id = $2) AS score
      `,
      [studentId, assessment.id],
    );
    expect(persisted.rows[0].attendance_count).toBe('1');
    expect(Number(persisted.rows[0].score)).toBe(17);
  });

  it('creates an invoice, records a payment, and retrieves its receipt', async () => {
    const schoolId = await factory.school();
    const otherSchoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    await factory.membership(otherSchoolId, admin.id, 'SCHOOL_ADMIN');
    const scope = await factory.academicScope(schoolId);
    const studentId = await factory.student(schoolId);
    await factory.enrollment(studentId, scope);

    const invoice = await harness.finance.createInvoice(
      {
        schoolId,
        studentId,
        invoiceStatus: 'ISSUED',
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        currencyCode: 'HTG',
        items: [
          {
            description: 'Pilot tuition installment',
            quantity: 1,
            unitAmount: 1000,
          },
        ],
      },
      admin.id,
      null,
      'invoice-workflow-20261001',
    );
    expect(invoice).toMatchObject({
      invoiceStatus: 'ISSUED',
      totalAmount: 1000,
      balanceDue: 1000,
    });
    const cashierSession = await harness.cashier.openSession(
      { schoolId, currencyCode: 'HTG', openingCashAmount: 0 },
      admin.id,
      null,
    );

    const payment = await harness.finance.recordPayment(
      {
        schoolId,
        invoiceId: invoice.id,
        cashierSessionId: cashierSession.id,
        amount: 400,
        paymentDate: cashierSession.businessDate,
        method: 'CASH',
        reference: 'RR-TEST-001',
      },
      admin.id,
      null,
      'payment-workflow-20261002',
    );
    expect(payment.invoice).toMatchObject({
      id: invoice.id,
      amountPaid: 400,
      balanceDue: 600,
    });

    const receipt = await harness.finance.getPaymentReceipt(
      { schoolId, paymentId: payment.paymentId },
      admin.id,
      null,
    );
    expect(receipt).toMatchObject({
      id: payment.paymentId,
      receiptNumber: payment.receiptNumber,
      amount: 400,
      student: { id: studentId },
      invoice: { id: invoice.id, balanceDue: 600 },
    });
    await expect(
      harness.finance.getPaymentReceipt(
        { schoolId: otherSchoolId, paymentId: payment.paymentId },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects cross-school record identifiers in attendance, grades, and finance', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(firstSchoolId, admin.id, 'SCHOOL_ADMIN');
    const foreignScope = await factory.academicScope(secondSchoolId);
    const foreignStudentId = await factory.student(secondSchoolId);
    await factory.enrollment(foreignStudentId, foreignScope);

    await expect(
      harness.attendance.submitAttendanceSession(
        {
          schoolId: firstSchoolId,
          sectionId: foreignScope.sectionId,
          attendanceDate: '2026-10-05',
          slot: 'MORNING',
          records: [{ studentId: foreignStudentId, status: 'PRESENT' }],
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      harness.gradebooks.createAssessment(
        {
          schoolId: firstSchoolId,
          sectionId: foreignScope.sectionId,
          subjectId: foreignScope.subjectId,
          title: 'Cross-school attempt',
          maxPoints: 20,
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      harness.finance.createInvoice(
        {
          schoolId: firstSchoolId,
          studentId: foreignStudentId,
          items: [{ description: 'Cross-school attempt', quantity: 1, unitAmount: 1 }],
        },
        admin.id,
        null,
        'invoice-cross-school-attempt',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replays identical finance requests without duplicate ledger entries', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const scope = await factory.academicScope(schoolId);
    const studentId = await factory.student(schoolId);
    await factory.enrollment(studentId, scope);

    const invoiceRequest = {
      schoolId,
      studentId,
      invoiceStatus: 'ISSUED' as const,
      currencyCode: 'HTG',
      items: [
        {
          description: 'Idempotent tuition',
          quantity: 1,
          unitAmount: 1000,
        },
      ],
    };
    const firstInvoice = await harness.finance.createInvoice(
      invoiceRequest,
      admin.id,
      null,
      'invoice-idempotency-same-request',
    );
    const replayedInvoice = await harness.finance.createInvoice(
      invoiceRequest,
      admin.id,
      null,
      'invoice-idempotency-same-request',
    );
    expect(replayedInvoice).toEqual(firstInvoice);

    await expect(
      harness.finance.createInvoice(
        {
          ...invoiceRequest,
          items: [
            {
              description: 'Changed request',
              quantity: 1,
              unitAmount: 1200,
            },
          ],
        },
        admin.id,
        null,
        'invoice-idempotency-same-request',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const cashierSession = await harness.cashier.openSession(
      { schoolId, currencyCode: 'HTG', openingCashAmount: 0 },
      admin.id,
      null,
    );
    const paymentRequest = {
      schoolId,
      invoiceId: firstInvoice.id,
      cashierSessionId: cashierSession.id,
      paymentDate: cashierSession.businessDate,
      amount: 400,
      method: 'CASH',
    };
    const firstPayment = await harness.finance.recordPayment(
      paymentRequest,
      admin.id,
      null,
      'payment-idempotency-same-request',
    );
    const replayedPayment = await harness.finance.recordPayment(
      paymentRequest,
      admin.id,
      null,
      'payment-idempotency-same-request',
    );
    expect(replayedPayment).toEqual(firstPayment);

    await expect(
      harness.finance.recordPayment(
        { ...paymentRequest, amount: 401 },
        admin.id,
        null,
        'payment-idempotency-same-request',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const persisted = await pool.query<{
      invoice_count: string;
      payment_count: string;
      amount_paid: string;
      balance_due: string;
      invoice_columns_match: boolean;
      payment_columns_match: boolean;
    }>(
      `
      SELECT
        (SELECT COUNT(*)::text FROM invoices WHERE school_id = $1) AS invoice_count,
        (SELECT COUNT(*)::text FROM payments WHERE school_id = $1) AS payment_count,
        (SELECT amount_paid::text FROM invoices WHERE id = $2) AS amount_paid,
        (SELECT balance_due::text FROM invoices WHERE id = $2) AS balance_due,
        (
          SELECT status::text = invoice_status::text
          FROM invoices
          WHERE id = $2
        ) AS invoice_columns_match,
        (
          SELECT status::text = payment_status::text
          FROM payments
          WHERE id = $3
        ) AS payment_columns_match
      `,
      [schoolId, firstInvoice.id, firstPayment.paymentId],
    );
    expect(persisted.rows[0]).toMatchObject({
      invoice_count: '1',
      payment_count: '1',
      amount_paid: '400.00',
      balance_due: '600.00',
      invoice_columns_match: true,
      payment_columns_match: true,
    });
  });

  it('serializes concurrent payments and prevents overpayment', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const scope = await factory.academicScope(schoolId);
    const studentId = await factory.student(schoolId);
    await factory.enrollment(studentId, scope);
    const invoice = await harness.finance.createInvoice(
      {
        schoolId,
        studentId,
        invoiceStatus: 'ISSUED',
        currencyCode: 'HTG',
        items: [
          {
            description: 'Concurrent collection test',
            quantity: 1,
            unitAmount: 1000,
          },
        ],
      },
      admin.id,
      null,
      'invoice-concurrency-test',
    );

    const cashierSession = await harness.cashier.openSession(
      { schoolId, currencyCode: 'HTG', openingCashAmount: 0 },
      admin.id,
      null,
    );
    const attempts = await Promise.allSettled([
      harness.finance.recordPayment(
        {
          schoolId,
          invoiceId: invoice.id,
          cashierSessionId: cashierSession.id,
          paymentDate: cashierSession.businessDate,
          amount: 700,
          method: 'CASH',
        },
        admin.id,
        null,
        'payment-concurrency-first',
      ),
      harness.finance.recordPayment(
        {
          schoolId,
          invoiceId: invoice.id,
          cashierSessionId: cashierSession.id,
          paymentDate: cashierSession.businessDate,
          amount: 700,
          method: 'CASH',
        },
        admin.id,
        null,
        'payment-concurrency-second',
      ),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(
      1,
    );

    const persisted = await pool.query<{
      amount_paid: string;
      balance_due: string;
      payment_count: string;
    }>(
      `
      SELECT
        inv.amount_paid::text AS amount_paid,
        inv.balance_due::text AS balance_due,
        COUNT(pay.id)::text AS payment_count
      FROM invoices inv
      LEFT JOIN payments pay
        ON pay.invoice_id = inv.id
       AND pay.payment_status = 'CONFIRMED'
       AND pay.deleted_at IS NULL
      WHERE inv.id = $1
      GROUP BY inv.id
      `,
      [invoice.id],
    );
    expect(persisted.rows[0]).toEqual({
      amount_paid: '700.00',
      balance_due: '300.00',
      payment_count: '1',
    });
  });

  it('enforces payment methods and reports each currency separately', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const scope = await factory.academicScope(schoolId);
    const studentId = await factory.student(schoolId);
    await factory.enrollment(studentId, scope);

    const htgInvoice = await harness.finance.createInvoice(
      {
        schoolId,
        studentId,
        currencyCode: 'HTG',
        items: [{ description: 'HTG charge', quantity: 1, unitAmount: 1000 }],
      },
      admin.id,
      null,
      'invoice-currency-htg',
    );
    await harness.finance.createInvoice(
      {
        schoolId,
        studentId,
        currencyCode: 'USD',
        items: [{ description: 'USD charge', quantity: 1, unitAmount: 20 }],
      },
      admin.id,
      null,
      'invoice-currency-usd',
    );

    const cashierSession = await harness.cashier.openSession(
      { schoolId, currencyCode: 'HTG', openingCashAmount: 0 },
      admin.id,
      null,
    );

    await expect(
      harness.finance.recordPayment(
        {
          schoolId,
          invoiceId: htgInvoice.id,
          cashierSessionId: cashierSession.id,
          amount: 100,
          method: 'BANK_TRANSFER',
        },
        admin.id,
        null,
        'payment-reference-required',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await pool.query(
      `
      INSERT INTO school_finance_settings (school_id, enabled_payment_methods)
      VALUES ($1, '["CASH"]'::jsonb)
      ON CONFLICT (school_id)
      WHERE deleted_at IS NULL
      DO UPDATE SET enabled_payment_methods = EXCLUDED.enabled_payment_methods
      `,
      [schoolId],
    );
    await expect(
      harness.finance.recordPayment(
        {
          schoolId,
          invoiceId: htgInvoice.id,
          cashierSessionId: cashierSession.id,
          amount: 100,
          method: 'CARD',
          reference: 'CARD-TEST',
        },
        admin.id,
        null,
        'payment-disabled-method',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const dashboard = await harness.finance.getFinanceDashboard(
      { schoolId },
      admin.id,
      null,
    );
    expect(dashboard.moneyByCurrency).toEqual([
      {
        currencyCode: 'HTG',
        totalInvoiced: 1000,
        totalPaid: 0,
        totalBalanceDue: 1000,
      },
      {
        currencyCode: 'USD',
        totalInvoiced: 20,
        totalPaid: 0,
        totalBalanceDue: 20,
      },
    ]);
  });
});
