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

describe('finance cashier workflow integration', () => {
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

  async function invoiceFixture(schoolId: string, actorUserId: string) {
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
            description: 'Cashier workflow tuition',
            quantity: 1,
            unitAmount: 1000,
          },
        ],
      },
      actorUserId,
      null,
      `cashier-invoice-${studentId}`,
    );
    return { invoice, studentId };
  }

  it('opens, reconciles, closes and supervisor-reopens a daily session', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const { invoice } = await invoiceFixture(schoolId, admin.id);

    const opened = await harness.cashier.openSession(
      {
        schoolId,
        currencyCode: 'HTG',
        openingCashAmount: 100,
      },
      admin.id,
      null,
    );
    expect(opened).toMatchObject({
      schoolId,
      cashierUserId: admin.id,
      currencyCode: 'HTG',
      status: 'OPEN',
      openingCashAmount: 100,
      expectedCashAmount: 100,
      collectionCount: 0,
    });

    const duplicateOpen = await harness.cashier.openSession(
      {
        schoolId,
        currencyCode: 'HTG',
        openingCashAmount: 999,
      },
      admin.id,
      null,
    );
    expect(duplicateOpen.id).toBe(opened.id);
    expect(duplicateOpen.openingCashAmount).toBe(100);

    const cashPayment = await harness.finance.recordPayment(
      {
        schoolId,
        invoiceId: invoice.id,
        cashierSessionId: opened.id,
        paymentDate: opened.businessDate,
        amount: 200,
        method: 'CASH',
      },
      admin.id,
      null,
      'cashier-payment-cash-001',
    );
    expect(cashPayment).toMatchObject({
      cashierSessionId: opened.id,
      amount: 200,
      invoice: { balanceDue: 800 },
    });

    const current = await harness.cashier.getCurrentSession(
      schoolId,
      'HTG',
      admin.id,
      true,
    );
    expect(current.session).toMatchObject({
      id: opened.id,
      expectedCashAmount: 300,
      collectionCount: 1,
      collectionTotal: 200,
      collectionsByMethod: [
        {
          paymentMethod: 'CASH',
          paymentCount: 1,
          totalAmount: 200,
        },
      ],
    });

    await expect(
      harness.cashier.reopenSession(
        opened.id,
        {
          schoolId,
          reason: 'Cashier requested correction',
        },
        admin.id,
        null,
        false,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const closed = await harness.cashier.closeSession(
      opened.id,
      {
        schoolId,
        closingCashAmount: 295,
      },
      admin.id,
      null,
      true,
    );
    expect(closed).toMatchObject({
      status: 'CLOSED',
      expectedCashAmount: 300,
      closingCashAmount: 295,
      varianceAmount: -5,
    });

    await expect(
      harness.finance.recordPayment(
        {
          schoolId,
          invoiceId: invoice.id,
          cashierSessionId: opened.id,
          paymentDate: opened.businessDate,
          amount: 50,
          method: 'CASH',
        },
        admin.id,
        null,
        'cashier-payment-after-close',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const reopened = await harness.cashier.reopenSession(
      opened.id,
      {
        schoolId,
        reason: 'Counted bundle was entered incorrectly',
      },
      admin.id,
      null,
      true,
    );
    expect(reopened).toMatchObject({
      status: 'OPEN',
      reopenedCount: 1,
      closingCashAmount: null,
      varianceAmount: null,
    });

    await harness.finance.recordPayment(
      {
        schoolId,
        invoiceId: invoice.id,
        cashierSessionId: opened.id,
        paymentDate: opened.businessDate,
        amount: 100,
        method: 'BANK_TRANSFER',
        reference: 'BANK-F2-001',
      },
      admin.id,
      null,
      'cashier-payment-bank-001',
    );
    const afterNonCash = await harness.cashier.getCurrentSession(
      schoolId,
      'HTG',
      admin.id,
      true,
    );
    expect(afterNonCash.session).toMatchObject({
      expectedCashAmount: 300,
      collectionCount: 2,
      collectionTotal: 300,
    });

    const reconciled = await harness.cashier.closeSession(
      opened.id,
      { schoolId, closingCashAmount: 300 },
      admin.id,
      null,
      true,
    );
    expect(reconciled).toMatchObject({
      status: 'CLOSED',
      expectedCashAmount: 300,
      closingCashAmount: 300,
      varianceAmount: 0,
    });

    const events = await pool.query<{
      event_type: string;
    }>(
      `
      SELECT event_type
      FROM finance_cashier_session_events
      WHERE cashier_session_id = $1
      ORDER BY created_at
      `,
      [opened.id],
    );
    expect(events.rows.map((row) => row.event_type)).toEqual([
      'OPENED',
      'CLOSED',
      'REOPENED',
      'CLOSED',
    ]);
  });

  it('audits initial prints and requires a reason for every reprint', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const { invoice } = await invoiceFixture(schoolId, admin.id);
    const cashierSession = await harness.cashier.openSession(
      {
        schoolId,
        currencyCode: 'HTG',
        openingCashAmount: 0,
      },
      admin.id,
      null,
    );
    const payment = await harness.finance.recordPayment(
      {
        schoolId,
        invoiceId: invoice.id,
        cashierSessionId: cashierSession.id,
        paymentDate: cashierSession.businessDate,
        amount: 100,
        method: 'CASH',
      },
      admin.id,
      null,
      'cashier-print-payment',
    );

    await expect(
      harness.cashier.recordReceiptPrint(
        payment.paymentId,
        { schoolId, printFormat: 'THERMAL_80MM' },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({
      printKind: 'INITIAL',
      printCount: 1,
    });
    await expect(
      harness.cashier.recordReceiptPrint(
        payment.paymentId,
        { schoolId, printFormat: 'A4' },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      harness.cashier.recordReceiptPrint(
        payment.paymentId,
        {
          schoolId,
          printFormat: 'A4',
          reason: 'Parent requested a duplicate copy',
        },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({
      printKind: 'REPRINT',
      printCount: 2,
    });

    await expect(
      harness.cashier.getReceiptPrintSummary(payment.paymentId, schoolId),
    ).resolves.toMatchObject({
      printCount: 2,
    });
  });

  it('rejects a different cashier, currency, date or school at the ledger boundary', async () => {
    const schoolId = await factory.school();
    const otherSchoolId = await factory.school();
    const admin = await factory.user();
    const otherAdmin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    await factory.membership(schoolId, otherAdmin.id, 'SCHOOL_ADMIN');
    const { invoice } = await invoiceFixture(schoolId, admin.id);
    const session = await harness.cashier.openSession(
      {
        schoolId,
        currencyCode: 'HTG',
        openingCashAmount: 0,
      },
      admin.id,
      null,
    );

    await expect(
      harness.finance.recordPayment(
        {
          schoolId,
          invoiceId: invoice.id,
          cashierSessionId: session.id,
          paymentDate: session.businessDate,
          amount: 10,
          method: 'CASH',
        },
        otherAdmin.id,
        null,
        'cashier-wrong-user',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      harness.finance.recordPayment(
        {
          schoolId,
          invoiceId: invoice.id,
          cashierSessionId: session.id,
          paymentDate: '2026-01-01',
          amount: 10,
          method: 'CASH',
        },
        admin.id,
        null,
        'cashier-wrong-date',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      harness.cashier.closeSession(
        session.id,
        { schoolId: otherSchoolId, closingCashAmount: 0 },
        admin.id,
        null,
        true,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
