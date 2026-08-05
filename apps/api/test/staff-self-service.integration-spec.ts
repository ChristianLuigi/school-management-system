import {
  BadRequestException,
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

describe('staff self-service integration', () => {
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

  async function staffUser(
    schoolId: string,
    role: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN' = 'TEACHER',
  ) {
    const user = await factory.user();
    await factory.membership(schoolId, user.id, role);
    const staffId = await factory.schoolStaffAccount(schoolId, user.id, {
      staffType: role,
      jobTitle: role === 'TEACHER' ? 'Mathematics Teacher' : 'Administrator',
      department: role === 'TEACHER' ? 'Academics' : 'Administration',
      createdByUserId: user.id,
    });
    return { ...user, staffId };
  }

  it('returns only the authenticated employee own safe staff profile', async () => {
    const schoolId = await factory.school();
    const employee = await staffUser(schoolId);
    await harness.staffManagement.updateStaffMedical(
      employee.staffId,
      {
        schoolId,
        rowVersion: 0,
        allergiesOrConditions: 'Private medical information',
      },
      (await staffUser(schoolId, 'SCHOOL_ADMIN')).id,
    );

    const profile = await harness.staffSelfService.getProfile(
      schoolId,
      employee.id,
    );

    expect(profile).toMatchObject({
      id: employee.staffId,
      jobTitle: 'Mathematics Teacher',
      department: 'Academics',
      employmentStatus: 'ACTIVE',
    });
    expect(profile).not.toHaveProperty('userId');
    expect(profile).not.toHaveProperty('rowVersion');
    expect(JSON.stringify(profile)).not.toContain(
      'Private medical information',
    );
  });

  it('shows and downloads only the employee active standard documents', async () => {
    const schoolId = await factory.school();
    const admin = await staffUser(schoolId, 'SCHOOL_ADMIN');
    const employee = await staffUser(schoolId);
    const standardStorageKey = `${schoolId}/${employee.staffId}/CONTRACT/contract.pdf`;
    const standard = await harness.staffCompliance.createDocument(
      employee.staffId,
      {
        schoolId,
        documentType: 'CONTRACT',
        displayName: 'Employment contract',
        storageKey: standardStorageKey,
        originalFileName: 'contract.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 512,
        confidentiality: 'STANDARD',
      },
      admin.id,
    );
    const restricted = await harness.staffCompliance.createDocument(
      employee.staffId,
      {
        schoolId,
        documentType: 'BACKGROUND_CHECK',
        displayName: 'Background review',
        storageKey: `${schoolId}/${employee.staffId}/BACKGROUND_CHECK/review.pdf`,
        originalFileName: 'review.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 512,
        confidentiality: 'RESTRICTED',
      },
      admin.id,
    );

    const listed = await harness.staffSelfService.listDocuments(
      schoolId,
      employee.id,
    );
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({
      id: standard.id,
      displayName: 'Employment contract',
    });
    expect(JSON.stringify(listed)).not.toContain(standardStorageKey);
    expect(JSON.stringify(listed)).not.toContain('Background review');

    const download = await harness.staffSelfService.getDocumentDownload(
      standard.id,
      schoolId,
      employee.id,
    );
    expect(download).toMatchObject({
      staffAccountId: employee.staffId,
      storageKey: standardStorageKey,
    });
    await expect(
      harness.staffSelfService.getDocumentDownload(
        restricted.id,
        schoolId,
        employee.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('submits and lists leave only for the authenticated employee', async () => {
    const schoolId = await factory.school();
    const employee = await staffUser(schoolId);
    const otherEmployee = await staffUser(schoolId);
    const privateReason = 'Private reason visible only in the leave workflow.';

    const leave = await harness.staffSelfService.createLeaveRequest(
      {
        schoolId,
        leaveType: 'ANNUAL',
        startDate: '2026-09-14',
        endDate: '2026-09-16',
        requestedDays: 3,
        reason: privateReason,
      },
      employee.id,
    );
    expect(leave).toMatchObject({
      status: 'SUBMITTED',
      reason: privateReason,
    });

    const ownRequests = await harness.staffSelfService.listLeaveRequests(
      schoolId,
      employee.id,
    );
    const otherRequests = await harness.staffSelfService.listLeaveRequests(
      schoolId,
      otherEmployee.id,
    );
    expect(ownRequests.items).toHaveLength(1);
    expect(otherRequests.items).toHaveLength(0);

    const activity = await pool.query<{ payload: Record<string, unknown> }>(
      `
      SELECT payload
      FROM platform_activity_logs
      WHERE school_id = $1
        AND event_type = 'STAFF_LEAVE_SUBMITTED'
      `,
      [schoolId],
    );
    expect(JSON.stringify(activity.rows)).not.toContain(privateReason);

    await expect(
      harness.staffSelfService.createLeaveRequest(
        {
          schoolId,
          leaveType: 'OTHER',
          startDate: '2026-09-16',
          endDate: '2026-09-17',
          requestedDays: 2,
          reason: 'Overlapping request.',
        },
        employee.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const cancelled = await harness.staffSelfService.cancelLeaveRequest(
      leave.id,
      {
        schoolId,
        rowVersion: leave.rowVersion,
      },
      employee.id,
    );
    expect(cancelled).toMatchObject({
      id: leave.id,
      status: 'CANCELLED',
      rowVersion: leave.rowVersion + 1,
    });

    await expect(
      harness.staffSelfService.cancelLeaveRequest(
        leave.id,
        {
          schoolId,
          rowVersion: cancelled.rowVersion,
        },
        employee.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('denies cross-school, suspended-staff, and deleted-school access', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const employee = await staffUser(firstSchoolId);

    await expect(
      harness.staffSelfService.getProfile(secondSchoolId, employee.id),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await pool.query(
      `
      UPDATE school_staff_accounts
      SET employment_status = 'SUSPENDED', status_reason = 'Test suspension.'
      WHERE id = $1
      `,
      [employee.staffId],
    );
    await expect(
      harness.staffSelfService.getProfile(firstSchoolId, employee.id),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await pool.query(
      `
      UPDATE school_staff_accounts
      SET employment_status = 'ACTIVE', status_reason = 'Test reactivation.'
      WHERE id = $1
      `,
      [employee.staffId],
    );
    await pool.query(
      'UPDATE schools SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [firstSchoolId],
    );
    await expect(
      harness.staffSelfService.getProfile(firstSchoolId, employee.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a staff role even when a staff record is linked', async () => {
    const schoolId = await factory.school();
    const parent = await factory.user();
    await factory.membership(schoolId, parent.id, 'PARENT');
    await factory.schoolStaffAccount(schoolId, parent.id, {
      staffType: 'TEACHER',
      employmentStatus: 'ACTIVE',
      createdByUserId: parent.id,
    });

    await expect(
      harness.staffSelfService.getProfile(schoolId, parent.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
