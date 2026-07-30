import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('school-admin payroll approval integration', () => {
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

  async function schoolAdministrator(schoolId: string) {
    const user = await factory.user();
    await factory.membership(schoolId, user.id, 'SCHOOL_ADMIN');
    return user;
  }

  async function financeOperator(schoolId: string, permissionCodes: string[]) {
    const user = await factory.user();
    await factory.membership(schoolId, user.id, 'FINANCE_ADMIN');
    for (const permissionCode of permissionCodes) {
      await pool.query(
        `
        INSERT INTO school_user_permissions (
          school_id,
          user_id,
          permission_code,
          granted_by_user_id
        )
        VALUES ($1,$2,$3,$2)
        `,
        [schoolId, user.id, permissionCode],
      );
    }
    return user;
  }

  async function linkedPayrollProfile(
    schoolId: string,
    actorUserId: string,
    input?: { baseSalary?: number; name?: string },
  ) {
    const staffUser = await factory.user();
    const [firstName, lastName] = (input?.name ?? 'Approval Employee').split(
      ' ',
      2,
    );
    await factory.membership(schoolId, staffUser.id, 'TEACHER');
    await pool.query(
      `
      UPDATE users
      SET first_name=$2,last_name=$3
      WHERE id=$1
      `,
      [staffUser.id, firstName, lastName],
    );
    const staffAccountId = await factory.schoolStaffAccount(
      schoolId,
      staffUser.id,
      {
        staffType: 'TEACHER',
        jobTitle: 'Teacher',
        department: 'Academics',
        createdByUserId: actorUserId,
      },
    );
    const profile = await harness.payroll.createPayrollProfile(
      {
        schoolId,
        staffAccountId,
        baseSalary: input?.baseSalary ?? 1000,
        currencyCode: 'HTG',
      },
      actorUserId,
      null,
    );
    return { staffUser, staffAccountId, profile };
  }

  async function createDraftRun(
    schoolId: string,
    actorUserId: string,
    suffix: string,
  ) {
    return harness.payroll.createPayrollRun(
      {
        schoolId,
        periodLabel: `Approval payroll ${suffix}`,
        periodStart: `2027-${suffix}-01`,
        periodEnd: `2027-${suffix}-28`,
        currencyCode: 'HTG',
      },
      actorUserId,
      null,
    );
  }

  async function moveToPendingApproval(input: {
    schoolId: string;
    runId: string;
    preparerUserId: string;
    reviewerUserId: string;
  }) {
    await harness.payroll.updatePayrollRunStatus(
      input.runId,
      { schoolId: input.schoolId, targetStatus: 'UNDER_REVIEW' },
      input.preparerUserId,
      null,
    );
    return harness.payroll.updatePayrollRunStatus(
      input.runId,
      { schoolId: input.schoolId, targetStatus: 'PENDING_APPROVAL' },
      input.reviewerUserId,
      null,
    );
  }

  it('reserves final approval for an active same-school School Admin', async () => {
    const schoolId = await factory.school({ managementMode: 'HYBRID_MANAGED' });
    const profileAdmin = await schoolAdministrator(schoolId);
    await linkedPayrollProfile(schoolId, profileAdmin.id);
    const preparer = await financeOperator(schoolId, ['PAYROLL_PREPARE']);
    const reviewer = await financeOperator(schoolId, ['PAYROLL_REVIEW']);
    const fullyPrivilegedFinance = await financeOperator(schoolId, [
      'PAYROLL_MANAGE',
      'PAYROLL_PREPARE',
      'PAYROLL_REVIEW',
      'PAYROLL_PROCESS',
      'PAYROLL_REVERSE',
    ]);
    const approver = await schoolAdministrator(schoolId);
    const run = await createDraftRun(schoolId, preparer.id, '01');
    await moveToPendingApproval({
      schoolId,
      runId: run.id,
      preparerUserId: preparer.id,
      reviewerUserId: reviewer.id,
    });

    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'APPROVED' },
        fullyPrivilegedFinance.id,
        null,
      ),
    ).rejects.toThrow(/school administrator/i);

    const foreignSchoolId = await factory.school();
    const foreignAdmin = await schoolAdministrator(foreignSchoolId);
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'APPROVED' },
        foreignAdmin.id,
        null,
      ),
    ).rejects.toThrow(/permission|access|administrator/i);

    const inactiveAdmin = await schoolAdministrator(schoolId);
    await pool.query(
      `
      UPDATE school_memberships
      SET membership_status='SUSPENDED',updated_at=NOW()
      WHERE school_id=$1 AND user_id=$2 AND deleted_at IS NULL
      `,
      [schoolId, inactiveAdmin.id],
    );
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'APPROVED' },
        inactiveAdmin.id,
        null,
      ),
    ).rejects.toThrow(/permission|access|administrator/i);

    const platformAdmin = await factory.user({ platformRole: 'SUPER_ADMIN' });
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        {
          schoolId,
          targetStatus: 'APPROVED',
          note: 'Platform override must not replace school approval.',
        },
        platformAdmin.id,
        'SUPER_ADMIN',
      ),
    ).rejects.toThrow(/school administrator/i);

    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        {
          schoolId,
          targetStatus: 'APPROVED',
          note: 'School totals and payment register reviewed.',
        },
        approver.id,
        null,
      ),
    ).resolves.toMatchObject({ run: { payrollStatus: 'APPROVED' } });
  });

  it('enforces prepare, review, process, return, and close responsibilities', async () => {
    const schoolId = await factory.school();
    const schoolAdmin = await schoolAdministrator(schoolId);
    await linkedPayrollProfile(schoolId, schoolAdmin.id);
    const preparer = await financeOperator(schoolId, ['PAYROLL_PREPARE']);
    const reviewer = await financeOperator(schoolId, ['PAYROLL_REVIEW']);
    const processor = await financeOperator(schoolId, ['PAYROLL_PROCESS']);
    const run = await createDraftRun(schoolId, preparer.id, '02');

    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'UNDER_REVIEW' },
        reviewer.id,
        null,
      ),
    ).rejects.toThrow(/preparation permission/i);
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      { schoolId, targetStatus: 'UNDER_REVIEW' },
      preparer.id,
      null,
    );
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'DRAFT' },
        reviewer.id,
        null,
      ),
    ).rejects.toThrow(/reason/i);
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId,
        targetStatus: 'DRAFT',
        note: 'Supporting payroll schedule needs correction.',
      },
      reviewer.id,
      null,
    );

    await harness.payroll.updatePayrollRunStatus(
      run.id,
      { schoolId, targetStatus: 'UNDER_REVIEW' },
      preparer.id,
      null,
    );
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'PENDING_APPROVAL' },
        preparer.id,
        null,
      ),
    ).rejects.toThrow(/reviewer|review|preparer/i);
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      { schoolId, targetStatus: 'PENDING_APPROVAL' },
      reviewer.id,
      null,
    );
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        {
          schoolId,
          targetStatus: 'DRAFT',
          note: 'Finance reviewer cannot return an approval decision.',
        },
        reviewer.id,
        null,
      ),
    ).rejects.toThrow(/school administrator/i);
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'DRAFT' },
        schoolAdmin.id,
        null,
      ),
    ).rejects.toThrow(/reason/i);
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId,
        targetStatus: 'DRAFT',
        note: 'School administrator returned the run for correction.',
      },
      schoolAdmin.id,
      null,
    );

    await moveToPendingApproval({
      schoolId,
      runId: run.id,
      preparerUserId: preparer.id,
      reviewerUserId: reviewer.id,
    });
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId,
        targetStatus: 'APPROVED',
        note: 'School administrator final approval.',
      },
      schoolAdmin.id,
      null,
    );
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'PROCESSING' },
        reviewer.id,
        null,
      ),
    ).rejects.toThrow(/processing permission/i);
    const processing = await harness.payroll.updatePayrollRunStatus(
      run.id,
      { schoolId, targetStatus: 'PROCESSING' },
      processor.id,
      null,
    );
    const itemId = processing.items[0].id;
    await harness.payroll.markPayrollItemPaid(
      itemId,
      {
        schoolId,
        paymentMethod: 'BANK_TRANSFER',
        paymentReference: 'ROLE-WORKFLOW-001',
      },
      processor.id,
      null,
    );
    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        {
          schoolId,
          targetStatus: 'CLOSED',
          note: 'Processor must not close payroll.',
        },
        processor.id,
        null,
      ),
    ).rejects.toThrow(/school administrator/i);
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId,
        targetStatus: 'CLOSED',
        note: 'Payment register reconciled by School Administrator.',
      },
      schoolAdmin.id,
      null,
    );
    await expect(
      pool.query(`UPDATE payroll_runs SET notes='late mutation' WHERE id=$1`, [
        run.id,
      ]),
    ).rejects.toThrow(/closed payroll runs are locked/i);
  });

  it('binds append-only approval decisions to the reviewed version and totals', async () => {
    const schoolId = await factory.school();
    const schoolAdmin = await schoolAdministrator(schoolId);
    await linkedPayrollProfile(schoolId, schoolAdmin.id, { baseSalary: 1000 });
    const preparer = await financeOperator(schoolId, ['PAYROLL_PREPARE']);
    const reviewer = await financeOperator(schoolId, ['PAYROLL_REVIEW']);
    const run = await createDraftRun(schoolId, preparer.id, '03');
    const pending = await moveToPendingApproval({
      schoolId,
      runId: run.id,
      preparerUserId: preparer.id,
      reviewerUserId: reviewer.id,
    });
    expect(pending.run).toMatchObject({
      payrollStatus: 'PENDING_APPROVAL',
      runVersion: 1,
    });
    expect(pending.run.contentChecksum).toMatch(/^[0-9a-f]{64}$/);
    const firstChecksum = pending.run.contentChecksum as string;
    const itemId = pending.items[0].id;

    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId,
        targetStatus: 'APPROVED',
        note: 'First School Administrator approval.',
      },
      schoolAdmin.id,
      null,
    );
    const firstDecision = await pool.query<{
      id: string;
      run_version: number;
      content_checksum: string;
      total_gross: string;
      total_allowances: string;
      total_deductions: string;
      total_net: string;
      staff_count: number;
      decision: string;
      actor_user_id: string;
      actor_role: string;
    }>(
      `
      SELECT
        id,
        run_version,
        content_checksum,
        total_gross::text,
        total_allowances::text,
        total_deductions::text,
        total_net::text,
        staff_count,
        decision,
        actor_user_id,
        actor_role
      FROM payroll_run_approvals
      WHERE payroll_run_id=$1
      ORDER BY created_at,id
      `,
      [run.id],
    );
    expect(firstDecision.rows[0]).toMatchObject({
      run_version: 1,
      content_checksum: firstChecksum,
      total_gross: '1000.00',
      total_allowances: '0.00',
      total_deductions: '0.00',
      total_net: '1000.00',
      staff_count: 1,
      decision: 'APPROVED',
      actor_user_id: schoolAdmin.id,
      actor_role: 'SCHOOL_ADMIN',
    });
    await expect(
      pool.query(
        `UPDATE payroll_run_approvals SET note='tampered' WHERE id=$1`,
        [firstDecision.rows[0].id],
      ),
    ).rejects.toThrow(/append-only/i);
    await expect(
      pool.query(`DELETE FROM payroll_run_approvals WHERE id=$1`, [
        firstDecision.rows[0].id,
      ]),
    ).rejects.toThrow(/append-only/i);

    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'DRAFT' },
        schoolAdmin.id,
        null,
      ),
    ).rejects.toThrow(/reason/i);
    const returned = await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId,
        targetStatus: 'DRAFT',
        note: 'Allowance must be corrected before payment.',
      },
      schoolAdmin.id,
      null,
    );
    expect(returned.run).toMatchObject({
      payrollStatus: 'DRAFT',
      runVersion: 2,
      contentChecksum: firstChecksum,
      approvedByUserId: null,
      approvedAt: null,
    });

    const adjusted = await harness.payroll.updatePayrollItemAdjustments(
      itemId,
      {
        schoolId,
        reason: 'Approved contractual transport allowance.',
        allowances: [
          {
            code: 'TRANSPORT',
            description: 'Transport allowance',
            amount: 125,
          },
        ],
        deductions: [],
      },
      preparer.id,
      null,
    );
    expect(adjusted.runTotals.totalNet).toBe(1125);
    const afterAdjustment = await harness.payroll.getPayrollRunDetails(
      { schoolId, payrollRunId: run.id },
      preparer.id,
      null,
    );
    expect(afterAdjustment.run.runVersion).toBeGreaterThan(2);
    expect(afterAdjustment.run.contentChecksum).toBeNull();

    const resubmitted = await moveToPendingApproval({
      schoolId,
      runId: run.id,
      preparerUserId: preparer.id,
      reviewerUserId: reviewer.id,
    });
    expect(resubmitted.run.contentChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(resubmitted.run.contentChecksum).not.toBe(firstChecksum);
    await harness.payroll.updatePayrollRunStatus(
      run.id,
      {
        schoolId,
        targetStatus: 'APPROVED',
        note: 'Corrected payroll approved.',
      },
      schoolAdmin.id,
      null,
    );

    const decisions = await pool.query<{
      run_version: number;
      content_checksum: string;
      total_net: string;
      decision: string;
    }>(
      `
      SELECT run_version,content_checksum,total_net::text,decision
      FROM payroll_run_approvals
      WHERE payroll_run_id=$1
      ORDER BY created_at,id
      `,
      [run.id],
    );
    expect(decisions.rows).toEqual([
      {
        run_version: 1,
        content_checksum: firstChecksum,
        total_net: '1000.00',
        decision: 'APPROVED',
      },
      {
        run_version: 1,
        content_checksum: firstChecksum,
        total_net: '1000.00',
        decision: 'RETURNED',
      },
      {
        run_version: afterAdjustment.run.runVersion,
        content_checksum: resubmitted.run.contentChecksum,
        total_net: '1125.00',
        decision: 'APPROVED',
      },
    ]);
  });

  it('limits the approval inbox to same-school pending runs and active School Admins', async () => {
    const schoolA = await factory.school();
    const schoolB = await factory.school();
    const adminA = await schoolAdministrator(schoolA);
    const adminB = await schoolAdministrator(schoolB);
    await linkedPayrollProfile(schoolA, adminA.id, {
      name: 'SchoolA Employee',
    });
    await linkedPayrollProfile(schoolB, adminB.id, {
      name: 'SchoolB Employee',
    });
    const preparerA = await financeOperator(schoolA, ['PAYROLL_PREPARE']);
    const reviewerA = await financeOperator(schoolA, ['PAYROLL_REVIEW']);
    const preparerB = await financeOperator(schoolB, ['PAYROLL_PREPARE']);
    const reviewerB = await financeOperator(schoolB, ['PAYROLL_REVIEW']);

    const pendingA = await createDraftRun(schoolA, preparerA.id, '05');
    await moveToPendingApproval({
      schoolId: schoolA,
      runId: pendingA.id,
      preparerUserId: preparerA.id,
      reviewerUserId: reviewerA.id,
    });
    const approvedA = await createDraftRun(schoolA, preparerA.id, '06');
    await moveToPendingApproval({
      schoolId: schoolA,
      runId: approvedA.id,
      preparerUserId: preparerA.id,
      reviewerUserId: reviewerA.id,
    });
    await harness.payroll.updatePayrollRunStatus(
      approvedA.id,
      { schoolId: schoolA, targetStatus: 'APPROVED' },
      adminA.id,
      null,
    );
    const pendingB = await createDraftRun(schoolB, preparerB.id, '05');
    await moveToPendingApproval({
      schoolId: schoolB,
      runId: pendingB.id,
      preparerUserId: preparerB.id,
      reviewerUserId: reviewerB.id,
    });

    const inbox = await harness.payroll.listApprovalInbox(
      { schoolId: schoolA },
      adminA.id,
      null,
    );
    expect(inbox).toMatchObject({ count: 1 });
    expect(inbox.runs.map((run) => run.id)).toEqual([pendingA.id]);
    expect(inbox.runs[0]).toMatchObject({
      preparedBy: { id: preparerA.id },
      reviewedBy: { id: reviewerA.id },
      runVersion: 1,
      staffCount: 1,
    });
    expect(inbox.runs[0].contentChecksum).toMatch(/^[0-9a-f]{64}$/);

    await expect(
      harness.payroll.listApprovalInbox(
        { schoolId: schoolA },
        reviewerA.id,
        null,
      ),
    ).rejects.toThrow(/school administrator/i);
    await expect(
      harness.payroll.listApprovalInbox({ schoolId: schoolB }, adminA.id, null),
    ).rejects.toThrow(/permission|access|administrator/i);
  });
  it('refuses to process legacy or stale approval state without a current approval record', async () => {
    const schoolId = await factory.school();
    const schoolAdmin = await schoolAdministrator(schoolId);
    await linkedPayrollProfile(schoolId, schoolAdmin.id);
    const preparer = await financeOperator(schoolId, ['PAYROLL_PREPARE']);
    const processor = await financeOperator(schoolId, ['PAYROLL_PROCESS']);
    const run = await createDraftRun(schoolId, preparer.id, '04');
    await pool.query(
      `UPDATE payroll_runs SET payroll_status='UNDER_REVIEW' WHERE id=$1`,
      [run.id],
    );
    await pool.query(
      `UPDATE payroll_runs SET payroll_status='PENDING_APPROVAL' WHERE id=$1`,
      [run.id],
    );
    await pool.query(
      `UPDATE payroll_runs SET payroll_status='APPROVED' WHERE id=$1`,
      [run.id],
    );

    await expect(
      harness.payroll.updatePayrollRunStatus(
        run.id,
        { schoolId, targetStatus: 'PROCESSING' },
        processor.id,
        null,
      ),
    ).rejects.toThrow(/approval|current payroll version/i);
    const approvalCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM payroll_run_approvals WHERE payroll_run_id=$1`,
      [run.id],
    );
    expect(approvalCount.rows[0].count).toBe('0');
  });
});
