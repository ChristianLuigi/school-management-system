import { NotFoundException } from '@nestjs/common';
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
    );
    expect(invoice).toMatchObject({
      invoiceStatus: 'ISSUED',
      totalAmount: 1000,
      balanceDue: 1000,
    });

    const payment = await harness.finance.recordPayment(
      {
        schoolId,
        invoiceId: invoice.id,
        amount: 400,
        paymentDate: '2026-10-02',
        method: 'CASH',
        reference: 'RR-TEST-001',
      },
      admin.id,
      null,
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
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});