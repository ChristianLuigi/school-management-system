import { ConflictException, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('finance deposit reconciliation and period closing integration', () => {
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

  async function closedCashSession() {
    const schoolId = await factory.school();
    const requester = await factory.user();
    const reviewer = await factory.user();
    await factory.membership(schoolId, requester.id, 'SCHOOL_ADMIN');
    await factory.membership(schoolId, reviewer.id, 'SCHOOL_ADMIN');
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
            description: 'Reconciliation test charge',
            quantity: 1,
            unitAmount: 1000,
          },
        ],
      },
      requester.id,
      null,
      'reconciliation-invoice-001',
    );
    const session = await harness.cashier.openSession(
      {
        schoolId,
        currencyCode: 'HTG',
        openingCashAmount: 100,
      },
      requester.id,
      null,
    );
    await harness.finance.recordPayment(
      {
        schoolId,
        invoiceId: invoice.id,
        cashierSessionId: session.id,
        paymentDate: session.businessDate,
        amount: 250,
        method: 'CASH',
      },
      requester.id,
      null,
      'reconciliation-payment-001',
    );
    await harness.cashier.closeSession(
      session.id,
      {
        schoolId,
        closingCashAmount: 350,
      },
      requester.id,
      null,
      true,
    );
    const bankAccount = await harness.reconciliation.createBankAccount(
      {
        schoolId,
        accountCode: 'OPERATING-HTG',
        displayName: 'Operating account',
        currencyCode: 'HTG',
        institutionName: 'Pilot bank',
        accountReferenceMasked: '****4821',
      },
      requester.id,
      null,
    );
    return {
      schoolId,
      requester,
      reviewer,
      scope,
      studentId,
      invoice,
      session,
      bankAccount,
    };
  }

  async function submitDeposit(
    value: Awaited<ReturnType<typeof closedCashSession>>,
    key: string,
  ) {
    return harness.reconciliation.createDeposit(
      {
        schoolId: value.schoolId,
        bankAccountId: value.bankAccount.id,
        cashierSessionIds: [value.session.id],
        depositDate: value.session.businessDate,
        depositedAmount: 250,
        depositReference: 'BANK-SLIP-4821',
        evidenceNote: 'Deposit slip retained in the finance office.',
      },
      value.requester.id,
      null,
      key,
    );
  }

  it('reconciles closed cashier collections with independent review and no reuse', async () => {
    const value = await closedCashSession();
    const deposit = await submitDeposit(value, 'deposit-submit-0001');

    expect(deposit).toMatchObject({
      schoolId: value.schoolId,
      bankAccountId: value.bankAccount.id,
      currencyCode: 'HTG',
      expectedAmount: 250,
      depositedAmount: 250,
      varianceAmount: 0,
      status: 'PENDING_REVIEW',
      requestedByUserId: value.requester.id,
    });
    expect(deposit.sessions).toEqual([
      expect.objectContaining({
        cashierSessionId: value.session.id,
        expectedCollectionAmount: 250,
        releasedAt: null,
      }),
    ]);

    await expect(
      harness.reconciliation.reconcileDeposit(
        deposit.id,
        {
          schoolId: value.schoolId,
          reviewNote: 'Reviewed against the original stamped bank slip.',
        },
        value.requester.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const reconciled = await harness.reconciliation.reconcileDeposit(
      deposit.id,
      {
        schoolId: value.schoolId,
        reviewNote: 'Reviewed against the original stamped bank slip.',
      },
      value.reviewer.id,
      null,
    );
    expect(reconciled).toMatchObject({
      status: 'RECONCILED',
      reviewedByUserId: value.reviewer.id,
    });

    await expect(
      submitDeposit(value, 'deposit-submit-0002'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('releases cashier sessions after rejection and rejects cross-school destinations', async () => {
    const value = await closedCashSession();
    const deposit = await submitDeposit(value, 'deposit-reject-0001');
    const rejected = await harness.reconciliation.rejectDeposit(
      deposit.id,
      {
        schoolId: value.schoolId,
        reviewNote: 'Bank reference is unreadable and must be submitted again.',
      },
      value.reviewer.id,
      null,
    );
    expect(rejected).toMatchObject({ status: 'REJECTED' });
    expect(rejected.sessions[0]?.cashierSessionId).toBe(value.session.id);
    expect(typeof rejected.sessions[0]?.releasedAt).toBe('string');

    const replacement = await submitDeposit(value, 'deposit-reject-0002');
    expect(replacement.status).toBe('PENDING_REVIEW');

    const otherSchoolId = await factory.school();
    const foreignAccount = await harness.reconciliation.createBankAccount(
      {
        schoolId: otherSchoolId,
        accountCode: 'FOREIGN-HTG',
        displayName: 'Other school account',
        currencyCode: 'HTG',
      },
      value.requester.id,
      null,
    );
    await expect(
      harness.reconciliation.createDeposit(
        {
          schoolId: value.schoolId,
          bankAccountId: foreignAccount.id,
          cashierSessionIds: [value.session.id],
          depositDate: value.session.businessDate,
          depositedAmount: 250,
          depositReference: 'CROSS-SCHOOL-ATTEMPT',
        },
        value.requester.id,
        null,
        'deposit-cross-school',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks period closing until cash is reconciled, then prevents ledger writes', async () => {
    const value = await closedCashSession();
    const period = await harness.reconciliation.createPeriod(
      {
        schoolId: value.schoolId,
        periodCode: 'DAY-CLOSE-001',
        displayName: 'Daily finance close',
        startDate: value.session.businessDate,
        endDate: value.session.businessDate,
      },
      value.requester.id,
      null,
    );

    const unreconciledCloseError = await harness.reconciliation
      .closePeriod(
        period.id,
        {
          schoolId: value.schoolId,
          reason: 'Close after all daily controls are complete.',
        },
        value.requester.id,
        null,
      )
      .catch((caught: unknown) => caught);
    expect(unreconciledCloseError).toBeInstanceOf(ConflictException);
    expect(
      (unreconciledCloseError as ConflictException).getResponse(),
    ).toMatchObject({
      blockers: { unreconciledCashierSessions: 1 },
    });

    const deposit = await submitDeposit(value, 'deposit-period-close');
    await harness.reconciliation.reconcileDeposit(
      deposit.id,
      {
        schoolId: value.schoolId,
        reviewNote: 'Deposit independently confirmed on the bank portal.',
      },
      value.reviewer.id,
      null,
    );
    const closed = await harness.reconciliation.closePeriod(
      period.id,
      {
        schoolId: value.schoolId,
        reason: 'All cashier collections and deposits are reconciled.',
      },
      value.requester.id,
      null,
    );
    expect(closed).toMatchObject({
      status: 'CLOSED',
      blockers: {
        openCashierSessions: 0,
        pendingDeposits: 0,
        pendingPaymentCorrections: 0,
        pendingCreditNotes: 0,
        unreconciledCashierSessions: 0,
      },
    });

    await expect(
      harness.finance.createInvoice(
        {
          schoolId: value.schoolId,
          studentId: value.studentId,
          invoiceStatus: 'ISSUED',
          issueDate: value.session.businessDate,
          currencyCode: 'HTG',
          items: [
            {
              description: 'Blocked closed-period charge',
              quantity: 1,
              unitAmount: 100,
            },
          ],
        },
        value.requester.id,
        null,
        'closed-period-invoice',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      harness.cashier.openSession(
        {
          schoolId: value.schoolId,
          businessDate: value.session.businessDate,
          currencyCode: 'USD',
          openingCashAmount: 0,
        },
        value.requester.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const reopened = await harness.reconciliation.reopenPeriod(
      period.id,
      {
        schoolId: value.schoolId,
        reason: 'Authorized reopening to post a documented late charge.',
      },
      value.reviewer.id,
      null,
    );
    expect(reopened).toMatchObject({
      status: 'OPEN',
      reopenCount: 1,
    });

    await expect(
      harness.finance.createInvoice(
        {
          schoolId: value.schoolId,
          studentId: value.studentId,
          invoiceStatus: 'ISSUED',
          issueDate: value.session.businessDate,
          currencyCode: 'HTG',
          items: [
            {
              description: 'Authorized late charge',
              quantity: 1,
              unitAmount: 100,
            },
          ],
        },
        value.requester.id,
        null,
        'reopened-period-invoice',
      ),
    ).resolves.toMatchObject({
      issueDate: value.session.businessDate,
      totalAmount: 100,
    });
  });

  it('reports open sessions and pending deposits as explicit close blockers', async () => {
    const schoolId = await factory.school();
    const administrator = await factory.user();
    await factory.membership(schoolId, administrator.id, 'SCHOOL_ADMIN');
    const session = await harness.cashier.openSession(
      {
        schoolId,
        currencyCode: 'HTG',
        openingCashAmount: 0,
      },
      administrator.id,
      null,
    );
    const period = await harness.reconciliation.createPeriod(
      {
        schoolId,
        periodCode: 'OPEN-SESSION-DAY',
        displayName: 'Open cashier session day',
        startDate: session.businessDate,
        endDate: session.businessDate,
      },
      administrator.id,
      null,
    );

    const openSessionCloseError = await harness.reconciliation
      .closePeriod(
        period.id,
        {
          schoolId,
          reason: 'Attempt close while a cashier session is still open.',
        },
        administrator.id,
        null,
      )
      .catch((caught: unknown) => caught);
    expect(openSessionCloseError).toBeInstanceOf(ConflictException);
    expect(
      (openSessionCloseError as ConflictException).getResponse(),
    ).toMatchObject({
      blockers: { openCashierSessions: 1 },
    });
  });
});
