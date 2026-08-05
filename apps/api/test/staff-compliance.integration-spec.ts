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

describe('staff documents, leave workflow, and reporting integration', () => {
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
    const staffId = await factory.schoolStaffAccount(schoolId, user.id, {
      staffType: 'SCHOOL_ADMIN',
      jobTitle: 'School Administrator',
      department: 'Administration',
    });
    return { ...user, staffId };
  }

  async function employee(schoolId: string, createdByUserId: string) {
    const user = await factory.user();
    const staffId = await factory.schoolStaffAccount(schoolId, user.id, {
      staffType: 'TEACHER',
      jobTitle: 'Teacher',
      department: 'Academics',
      createdByUserId,
    });
    return { ...user, staffId };
  }

  it('stores safe document metadata, reports expiry, and revokes downloads', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const staff = await employee(schoolId, admin.id);
    const storageKey = `${schoolId}/${staff.staffId}/LICENSE/license.pdf`;

    const document = await harness.staffCompliance.createDocument(
      staff.staffId,
      {
        schoolId,
        documentType: 'LICENSE',
        displayName: 'Teaching license',
        storageKey,
        originalFileName: 'license.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 512,
        issuedOn: '2024-01-01',
        expiresOn: '2025-01-01',
        confidentiality: 'RESTRICTED',
      },
      admin.id,
    );

    expect(document).toMatchObject({
      documentType: 'LICENSE',
      status: 'ACTIVE',
      expiryStatus: 'EXPIRED',
      rowVersion: 1,
    });
    expect(document).not.toHaveProperty('storageKey');

    const listed = await harness.staffCompliance.listDocuments(
      staff.staffId,
      schoolId,
      admin.id,
    );
    expect(JSON.stringify(listed)).not.toContain(storageKey);
    expect(listed.items).toHaveLength(1);

    const download = await harness.staffCompliance.getDocumentDownload(
      staff.staffId,
      document.id,
      schoolId,
      admin.id,
    );
    expect(download).toMatchObject({
      storageKey,
      mimeType: 'application/pdf',
    });

    const revoked = await harness.staffCompliance.revokeDocument(
      staff.staffId,
      document.id,
      {
        schoolId,
        rowVersion: document.rowVersion,
        reason: 'Superseded by a renewed license.',
      },
      admin.id,
    );
    expect(revoked).toMatchObject({
      status: 'REVOKED',
      rowVersion: 2,
    });
    await expect(
      harness.staffCompliance.getDocumentDownload(
        staff.staffId,
        document.id,
        schoolId,
        admin.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const activity = await pool.query<{ payload: Record<string, unknown> }>(
      `
      SELECT payload
      FROM platform_activity_logs
      WHERE school_id = $1
        AND event_type = 'STAFF_DOCUMENT_ADDED'
      `,
      [schoolId],
    );
    expect(JSON.stringify(activity.rows)).not.toContain(storageKey);
    expect(JSON.stringify(activity.rows)).not.toContain('license.pdf');
  });

  it('denies cross-school document access', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const firstAdmin = await administrator(firstSchoolId);
    const secondAdmin = await administrator(secondSchoolId);
    const staff = await employee(firstSchoolId, firstAdmin.id);

    await expect(
      harness.staffCompliance.listDocuments(
        staff.staffId,
        firstSchoolId,
        secondAdmin.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unsafe document metadata and stale revocation versions', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const staff = await employee(schoolId, admin.id);

    await expect(
      harness.staffCompliance.createDocument(
        staff.staffId,
        {
          schoolId,
          documentType: 'LICENSE',
          displayName: 'Unsafe document',
          storageKey: schoolId + '/' + staff.staffId + '/../outside.pdf',
          originalFileName: 'outside.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 128,
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      harness.staffCompliance.createDocument(
        staff.staffId,
        {
          schoolId,
          documentType: 'CERTIFICATION',
          displayName: 'Invalid dates',
          storageKey:
            schoolId + '/' + staff.staffId + '/CERTIFICATION/invalid.pdf',
          originalFileName: 'invalid.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 128,
          issuedOn: '2026-08-04',
          expiresOn: '2026-08-03',
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const document = await harness.staffCompliance.createDocument(
      staff.staffId,
      {
        schoolId,
        documentType: 'CONTRACT',
        displayName: 'Employment contract',
        storageKey: schoolId + '/' + staff.staffId + '/CONTRACT/contract.pdf',
        originalFileName: 'contract.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 256,
      },
      admin.id,
    );

    await expect(
      harness.staffCompliance.revokeDocument(
        staff.staffId,
        document.id,
        {
          schoolId,
          rowVersion: document.rowVersion + 1,
          reason: 'Attempt using stale browser state.',
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('enforces leave overlap, separation of duties, and append-only history', async () => {
    const schoolId = await factory.school();
    const preparer = await administrator(schoolId);
    const approver = await administrator(schoolId);
    const staff = await employee(schoolId, preparer.id);

    const leave = await harness.staffCompliance.createLeaveRequest(
      staff.staffId,
      {
        schoolId,
        leaveType: 'ANNUAL',
        startDate: '2026-08-03',
        endDate: '2026-08-07',
        requestedDays: 5,
        reason: 'Annual leave recorded by administration.',
      },
      preparer.id,
    );
    expect(leave).toMatchObject({
      status: 'SUBMITTED',
      rowVersion: 1,
    });

    await expect(
      harness.staffCompliance.createLeaveRequest(
        staff.staffId,
        {
          schoolId,
          leaveType: 'OTHER',
          startDate: '2026-08-07',
          endDate: '2026-08-08',
          requestedDays: 2,
          reason: 'Overlapping request.',
        },
        preparer.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      harness.staffCompliance.approveLeaveRequest(
        leave.id,
        { schoolId, rowVersion: leave.rowVersion },
        preparer.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const approved = await harness.staffCompliance.approveLeaveRequest(
      leave.id,
      {
        schoolId,
        rowVersion: leave.rowVersion,
        note: 'Coverage confirmed.',
      },
      approver.id,
    );
    expect(approved).toMatchObject({
      status: 'APPROVED',
      reviewedByUserId: approver.id,
      rowVersion: 2,
    });

    const history = await harness.staffCompliance.listLeaveRequests(
      staff.staffId,
      schoolId,
      preparer.id,
    );
    expect(history.items[0].events.map((event) => event.type)).toEqual([
      'SUBMITTED',
      'APPROVED',
    ]);
    await expect(
      pool.query(
        `
        UPDATE staff_leave_request_events
        SET note = 'Tampered'
        WHERE leave_request_id = $1
        `,
        [leave.id],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });

    const cancelled = await harness.staffCompliance.cancelLeaveRequest(
      leave.id,
      {
        schoolId,
        rowVersion: approved.rowVersion,
        note: 'Leave dates no longer required.',
      },
      preparer.id,
    );
    expect(cancelled).toMatchObject({
      status: 'CANCELLED',
      rowVersion: 3,
    });
  });

  it('enforces rejection rules and keeps leave reasons out of activity payloads', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const staff = await employee(schoolId, admin.id);
    const privateReason = 'Private family circumstance for this test.';
    const privateReviewNote = 'Confidential supporting information reviewed.';

    const leave = await harness.staffCompliance.createLeaveRequest(
      staff.staffId,
      {
        schoolId,
        leaveType: 'OTHER',
        startDate: '2026-09-14',
        endDate: '2026-09-15',
        requestedDays: 2,
        reason: privateReason,
      },
      admin.id,
    );

    await expect(
      harness.staffCompliance.rejectLeaveRequest(
        leave.id,
        { schoolId, rowVersion: leave.rowVersion },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const rejected = await harness.staffCompliance.rejectLeaveRequest(
      leave.id,
      {
        schoolId,
        rowVersion: leave.rowVersion,
        note: privateReviewNote,
      },
      admin.id,
    );
    expect(rejected).toMatchObject({
      status: 'REJECTED',
      reviewNote: privateReviewNote,
      rowVersion: 2,
    });

    await expect(
      harness.staffCompliance.approveLeaveRequest(
        leave.id,
        { schoolId, rowVersion: leave.rowVersion },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const activity = await pool.query<{ payload: Record<string, unknown> }>(
      "SELECT payload FROM platform_activity_logs WHERE school_id = $1 AND event_type IN ('STAFF_LEAVE_SUBMITTED', 'STAFF_LEAVE_REJECTED')",
      [schoolId],
    );
    expect(JSON.stringify(activity.rows)).not.toContain(privateReason);
    expect(JSON.stringify(activity.rows)).not.toContain(privateReviewNote);
  });

  it('allows self-approval with one administrator and denies deleted-school access', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const staff = await employee(schoolId, admin.id);
    const leave = await harness.staffCompliance.createLeaveRequest(
      staff.staffId,
      {
        schoolId,
        leaveType: 'ANNUAL',
        startDate: '2026-10-05',
        endDate: '2026-10-06',
        requestedDays: 2,
        reason: 'Short annual leave.',
      },
      admin.id,
    );

    const approved = await harness.staffCompliance.approveLeaveRequest(
      leave.id,
      { schoolId, rowVersion: leave.rowVersion },
      admin.id,
    );
    expect(approved.status).toBe('APPROVED');

    await pool.query(
      'UPDATE schools SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [schoolId],
    );

    await expect(
      harness.staffCompliance.listDocuments(staff.staffId, schoolId, admin.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      harness.staffCompliance.getOperationalReport({ schoolId }, admin.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies cross-school leave mutations and operational reports', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const firstAdmin = await administrator(firstSchoolId);
    const secondAdmin = await administrator(secondSchoolId);
    const staff = await employee(firstSchoolId, firstAdmin.id);

    await expect(
      harness.staffCompliance.createLeaveRequest(
        staff.staffId,
        {
          schoolId: firstSchoolId,
          leaveType: 'OTHER',
          startDate: '2026-11-02',
          endDate: '2026-11-02',
          requestedDays: 1,
          reason: 'Cross-school mutation attempt.',
        },
        secondAdmin.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      harness.staffCompliance.getOperationalReport(
        { schoolId: firstSchoolId, credentialWindowDays: 60 },
        secondAdmin.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('returns operational alerts without medical information', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const staff = await employee(schoolId, admin.id);
    await harness.staffManagement.updateStaffMedical(
      staff.staffId,
      {
        schoolId,
        rowVersion: 0,
        allergiesOrConditions: 'Confidential condition',
      },
      admin.id,
    );
    await harness.staffCompliance.createDocument(
      staff.staffId,
      {
        schoolId,
        documentType: 'CERTIFICATION',
        displayName: 'Professional certificate',
        storageKey: `${schoolId}/${staff.staffId}/CERTIFICATION/certificate.pdf`,
        originalFileName: 'certificate.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 256,
        expiresOn: '2025-12-31',
      },
      admin.id,
    );

    const report = await harness.staffCompliance.getOperationalReport(
      { schoolId, credentialWindowDays: 90 },
      admin.id,
    );
    expect(report.totals.staff).toBe(2);
    expect(report.totals.expiredCredentials).toBe(1);
    expect(report.credentialAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          staffId: staff.staffId,
          expiryStatus: 'EXPIRED',
        }),
      ]),
    );
    expect(JSON.stringify(report)).not.toContain('Confidential condition');
  });
});
