import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('controlled finance corrections integration', () => {
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

  async function financeFixture(amount = 1000) {
    const schoolId = await factory.school();
    const requester = await factory.user();
    const reviewer = await factory.user();
    const processor = await factory.user();
    await factory.membership(schoolId, requester.id, 'SCHOOL_ADMIN');
    await factory.membership(schoolId, reviewer.id, 'SCHOOL_ADMIN');
    await factory.membership(schoolId, processor.id, 'SCHOOL_ADMIN');
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
            description: 'Controlled correction fixture',
            quantity: 1,
            unitAmount: amount,
          },
        ],
      },
      requester.id,
      null,
      `correction-invoice-${studentId}`,
    );
    return {
      schoolId,
      requester,
      reviewer,
      processor,
      studentId,
      invoice,
    };
  }

  async function cashPayment(
    fixture: Awaited<ReturnType<typeof financeFixture>>,
    amount: number,
    suffix: string,
  ) {
    const session = await harness.cashier.openSession(
      {
        schoolId: fixture.schoolId,
        currencyCode: 'HTG',
        openingCashAmount: 0,
      },
      fixture.requester.id,
      null,
    );
    const payment = await harness.finance.recordPayment(
      {
        schoolId: fixture.schoolId,
        invoiceId: fixture.invoice.id,
        cashierSessionId: session.id,
        paymentDate: session.businessDate,
        amount,
        method: 'CASH',
      },
      fixture.requester.id,
      null,
      `correction-payment-${suffix}`,
    );
    return { payment, session };
  }

  it('reverses a payment through independent approval without mutating the original record', async () => {
    const fixture = await financeFixture();
    const { payment } = await cashPayment(fixture, 400, 'reversal');

    const requested = await harness.corrections.requestPaymentCorrection(
      payment.paymentId,
      {
        schoolId: fixture.schoolId,
        correctionType: 'REVERSAL',
        reason: 'The payment was recorded against the wrong payer.',
      },
      fixture.requester.id,
      null,
      'payment-reversal-request-001',
    );
    expect(requested).toMatchObject({
      paymentId: payment.paymentId,
      correctionType: 'REVERSAL',
      status: 'PENDING_REVIEW',
      amount: 400,
    });

    await expect(
      harness.corrections.requestPaymentCorrection(
        payment.paymentId,
        {
          schoolId: fixture.schoolId,
          correctionType: 'REVERSAL',
          reason: 'The payment was recorded against the wrong payer.',
        },
        fixture.requester.id,
        null,
        'payment-reversal-request-001',
      ),
    ).resolves.toMatchObject({ id: requested.id });

    await expect(
      harness.corrections.approvePaymentCorrection(
        requested.id,
        { schoolId: fixture.schoolId },
        fixture.requester.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const approved = await harness.corrections.approvePaymentCorrection(
      requested.id,
      {
        schoolId: fixture.schoolId,
        reviewNote: 'Evidence checked against the cashier records.',
      },
      fixture.reviewer.id,
      null,
    );
    expect(approved.status).toBe('APPROVED');

    const processed = await harness.corrections.processPaymentCorrection(
      requested.id,
      { schoolId: fixture.schoolId },
      fixture.processor.id,
      null,
    );
    expect(processed).toMatchObject({
      correction: { status: 'COMPLETED', correctionType: 'REVERSAL' },
      invoice: { amountPaid: 0, balanceDue: 1000 },
    });

    const original = await pool.query<{
      payment_status: string;
      deleted_at: string | null;
    }>(
      `
      SELECT payment_status::text AS payment_status, deleted_at::text
      FROM payments
      WHERE id = $1
      `,
      [payment.paymentId],
    );
    expect(original.rows[0]).toEqual({
      payment_status: 'CONFIRMED',
      deleted_at: null,
    });

    const receipt = await harness.finance.getPaymentReceipt(
      {
        schoolId: fixture.schoolId,
        paymentId: payment.paymentId,
      },
      fixture.requester.id,
      null,
    );
    expect(receipt.paymentStatus).toBe('REVERSED');
    const overview = await harness.finance.getOverview(fixture.schoolId);
    expect(overview.payments.confirmedPayments).toBe(0);
    const dashboard = await harness.finance.getFinanceDashboard(
      { schoolId: fixture.schoolId },
      fixture.requester.id,
      null,
    );
    expect(dashboard.totals.paymentCount).toBe(0);

    const events = await pool.query<{ event_type: string }>(
      `
      SELECT event_type
      FROM finance_correction_events
      WHERE subject_id = $1
      ORDER BY created_at
      `,
      [requested.id],
    );
    expect(events.rows.map((row) => row.event_type)).toEqual([
      'REQUESTED',
      'APPROVED',
      'COMPLETED',
    ]);

    await expect(
      harness.corrections.requestPaymentCorrection(
        payment.paymentId,
        {
          schoolId: fixture.schoolId,
          correctionType: 'REFUND',
          reason: 'A second correction must never replace completed history.',
        },
        fixture.requester.id,
        null,
        'payment-second-correction-001',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('records cash and non-cash refunds with settlement controls and cashier reconciliation', async () => {
    const fixture = await financeFixture(1200);
    const first = await cashPayment(fixture, 200, 'cash-refund');
    const requested = await harness.corrections.requestPaymentCorrection(
      first.payment.paymentId,
      {
        schoolId: fixture.schoolId,
        correctionType: 'REFUND',
        reason: 'The family paid twice and requested the duplicate back.',
      },
      fixture.requester.id,
      null,
      'cash-refund-request-001',
    );
    await harness.corrections.approvePaymentCorrection(
      requested.id,
      { schoolId: fixture.schoolId },
      fixture.reviewer.id,
      null,
    );

    await expect(
      harness.corrections.processPaymentCorrection(
        requested.id,
        {
          schoolId: fixture.schoolId,
          refundMethod: 'CASH',
        },
        fixture.processor.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const refundSession = await harness.cashier.openSession(
      {
        schoolId: fixture.schoolId,
        currencyCode: 'HTG',
        openingCashAmount: 500,
      },
      fixture.processor.id,
      null,
    );
    await harness.corrections.processPaymentCorrection(
      requested.id,
      {
        schoolId: fixture.schoolId,
        refundMethod: 'CASH',
        cashierSessionId: refundSession.id,
      },
      fixture.processor.id,
      null,
    );
    const refundDrawer = await harness.cashier.getCurrentSession(
      fixture.schoolId,
      'HTG',
      fixture.processor.id,
      false,
    );
    expect(refundDrawer.session).toMatchObject({
      expectedCashAmount: 300,
      collectionCount: 0,
      refundCount: 1,
      grossCollectionTotal: 0,
      refundTotal: 200,
      collectionTotal: -200,
      collectionsByMethod: [
        {
          paymentMethod: 'CASH',
          paymentCount: 0,
          refundCount: 1,
          refundAmount: 200,
          totalAmount: -200,
        },
      ],
    });

    const second = await harness.finance.recordPayment(
      {
        schoolId: fixture.schoolId,
        invoiceId: fixture.invoice.id,
        cashierSessionId: first.session.id,
        paymentDate: first.session.businessDate,
        amount: 100,
        method: 'BANK_TRANSFER',
        reference: 'BANK-PAYMENT-F3',
      },
      fixture.requester.id,
      null,
      'correction-payment-bank-refund',
    );
    const bankRefund = await harness.corrections.requestPaymentCorrection(
      second.paymentId,
      {
        schoolId: fixture.schoolId,
        correctionType: 'REFUND',
        reason: 'The bank confirmed this duplicate transfer was returned.',
      },
      fixture.requester.id,
      null,
      'bank-refund-request-001',
    );
    await harness.corrections.approvePaymentCorrection(
      bankRefund.id,
      { schoolId: fixture.schoolId },
      fixture.reviewer.id,
      null,
    );
    await expect(
      harness.corrections.processPaymentCorrection(
        bankRefund.id,
        {
          schoolId: fixture.schoolId,
          refundMethod: 'BANK_TRANSFER',
        },
        fixture.processor.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      harness.corrections.processPaymentCorrection(
        bankRefund.id,
        {
          schoolId: fixture.schoolId,
          refundMethod: 'BANK_TRANSFER',
          refundReference: 'BANK-REFUND-F3-001',
        },
        fixture.processor.id,
        null,
      ),
    ).resolves.toMatchObject({
      correction: {
        status: 'COMPLETED',
        refundMethod: 'BANK_TRANSFER',
        refundReference: 'BANK-REFUND-F3-001',
      },
    });
  });

  it('applies an independently approved credit note and rejects unsafe requests', async () => {
    const fixture = await financeFixture();
    const otherSchoolId = await factory.school();

    const requested = await harness.corrections.requestCreditNote(
      fixture.invoice.id,
      {
        schoolId: fixture.schoolId,
        amount: 250,
        reason: 'A documented scholarship adjustment was approved.',
      },
      fixture.requester.id,
      null,
      'credit-note-request-001',
    );
    expect(requested).toMatchObject({
      status: 'PENDING_REVIEW',
      amount: 250,
      invoiceId: fixture.invoice.id,
    });
    await expect(
      harness.corrections.requestCreditNote(
        fixture.invoice.id,
        {
          schoolId: fixture.schoolId,
          amount: 250,
          reason: 'A documented scholarship adjustment was approved.',
        },
        fixture.requester.id,
        null,
        'credit-note-request-001',
      ),
    ).resolves.toMatchObject({ id: requested.id });
    await expect(
      harness.corrections.requestCreditNote(
        fixture.invoice.id,
        {
          schoolId: fixture.schoolId,
          amount: 10,
          reason: 'Another pending credit must wait for review.',
        },
        fixture.requester.id,
        null,
        'credit-note-request-002',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      harness.corrections.approveCreditNote(
        requested.id,
        { schoolId: fixture.schoolId },
        fixture.requester.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const applied = await harness.corrections.approveCreditNote(
      requested.id,
      {
        schoolId: fixture.schoolId,
        reviewNote: 'Scholarship authorization was independently verified.',
      },
      fixture.reviewer.id,
      null,
    );
    expect(applied).toMatchObject({
      status: 'APPLIED',
      invoice: {
        totalAmount: 750,
        amountPaid: 0,
        balanceDue: 750,
      },
    });

    await expect(
      harness.corrections.requestCreditNote(
        fixture.invoice.id,
        {
          schoolId: fixture.schoolId,
          amount: 751,
          reason: 'This amount exceeds the remaining invoice balance.',
        },
        fixture.requester.id,
        null,
        'credit-note-too-large-001',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      harness.corrections.requestCreditNote(
        fixture.invoice.id,
        {
          schoolId: otherSchoolId,
          amount: 10,
          reason: 'Cross-school invoice access must always be rejected.',
        },
        fixture.requester.id,
        null,
        'credit-note-cross-school-001',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
