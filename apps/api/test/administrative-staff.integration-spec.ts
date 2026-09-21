import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import { AdmissionsService } from '../src/admissions/admissions.service';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('administrative staff and delegated school administrators', () => {
  it.each(['SCHOOL_ADMIN', 'ADMIN_STAFF'] as const)(
    'invites %s from its matching staff category',
    async (roleCode) => {
      const schoolId = await factory.school();
      const admin = await factory.user();
      await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
      const staff = await h.staffManagement.createStaff(
        {
          schoolId,
          firstName: 'Nadine',
          lastName: 'Joseph',
          email: 'nadine@role.test',
          staffCategory:
            roleCode === 'SCHOOL_ADMIN'
              ? 'SCHOOL_LEADERSHIP'
              : 'ADMINISTRATIVE',
          employmentType: 'FULL_TIME',
          employmentStatus: 'ACTIVE',
          reason: 'Employment approved.',
        },
        admin.id,
      );
      await expect(
        h.staffManagement.createStaffInvitation(
          staff.id,
          { schoolId, roleCode },
          admin.id,
        ),
      ).resolves.toMatchObject({ emailSent: true });
      const token = decodeURIComponent(
        h.email.invitations[0].activationUrl.split('#token=')[1],
      );
      const password = 'Harbor Quartz 83!Velvet Compass';
      const accepted = await h.invitations.acceptInvitation({
        token,
        password,
        passwordConfirmation: password,
        firstName: 'Nadine',
        lastName: 'Joseph',
      });
      const linked = await pool.query(
        'SELECT user_id, staff_type FROM school_staff_accounts WHERE id=$1',
        [staff.id],
      );
      expect(linked.rows[0]).toEqual({
        user_id: accepted.userId,
        staff_type: roleCode,
      });
    },
  );
  let pool: Pool;
  let h: Awaited<ReturnType<typeof createServiceHarness>>;
  let factory: IntegrationFactory;
  let admissions: AdmissionsService;
  beforeAll(async () => {
    pool = createIntegrationPool();
    h = await createServiceHarness();
    factory = new IntegrationFactory(pool, h.passwords, h.sessionTokens);
    admissions = new AdmissionsService(h.db, h.activity);
  });
  beforeEach(async () => {
    await resetIntegrationDatabase(pool);
    h.email.reset();
  });
  afterAll(async () => {
    await h.close();
    await pool.end();
  });

  it.each(['SCHOOL_ADMIN', 'ADMIN_STAFF'] as const)(
    'invites and activates %s without platform privileges',
    async (roleCode) => {
      const schoolId = await factory.school();
      const admin = await factory.user();
      await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
      const email = `${roleCode.toLowerCase()}@role.test`;
      await h.invitations.createInvitation(
        { schoolId, email, roleCode },
        admin.id,
        null,
      );
      const token = decodeURIComponent(
        h.email.invitations[0].activationUrl.split('#token=')[1],
      );
      const password = 'Harbor Quartz 83!Velvet Compass';
      const accepted = await h.invitations.acceptInvitation({
        token,
        password,
        passwordConfirmation: password,
        firstName: 'Office',
        lastName: 'Tester',
      });
      const result = await pool.query(
        `SELECT staff.staff_type, staff.staff_category, u.platform_role FROM school_staff_accounts staff JOIN users u ON u.id=staff.user_id WHERE staff.user_id=$1 AND staff.school_id=$2`,
        [accepted.userId, schoolId],
      );
      expect(result.rows[0]).toMatchObject({
        staff_type: roleCode,
        staff_category:
          roleCode === 'ADMIN_STAFF' ? 'ADMINISTRATIVE' : 'SCHOOL_LEADERSHIP',
        platform_role: null,
      });
      const login = await h.auth.login({ email, password });
      expect(
        (await h.auth.requireSession(`Bearer ${login.sessionToken}`)).user_id,
      ).toBe(accepted.userId);
      const permissions = await pool.query(
        'SELECT id FROM school_user_permissions WHERE user_id=$1',
        [accepted.userId],
      );
      expect(permissions.rowCount).toBe(0);
    },
  );

  it('permits identity edits but rejects medical, enrollment and cross-school writes', async () => {
    const schoolId = await factory.school();
    const otherSchoolId = await factory.school();
    const office = await factory.user();
    await factory.membership(schoolId, office.id, 'ADMIN_STAFF');
    const student = await h.schoolStudents.createStudent(
      { schoolId, firstName: 'Anne', lastName: 'Test' },
      office.id,
      null,
    );
    await h.schoolStudents.updateStudent(
      student.id,
      { schoolId, firstName: 'Anna' },
      office.id,
      null,
    );
    await pool.query(
      'UPDATE students SET medical_notes=$2, allergies=$2, health_notes=$2 WHERE id=$1',
      [student.id, 'PRIVATE_MEDICAL_MARKER'],
    );
    const details = await h.schoolStudents.getStudentDetails(
      { schoolId, studentId: student.id },
      office.id,
      null,
    );
    expect(details.student.firstName).toBe('Anna');
    expect(details.finance).toBeNull();
    expect(details.recentInvoices).toEqual([]);
    expect(details.documentRecords).toEqual([]);
    expect(JSON.stringify(details)).not.toContain('PRIVATE_MEDICAL_MARKER');
    await expect(
      h.schoolStudents.updateStudent(
        student.id,
        { schoolId, medicalNotes: 'not allowed' },
        office.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      h.schoolStudents.updateStudent(
        student.id,
        { schoolId, clearSection: true },
        office.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      h.schoolStudents.createStudent(
        { schoolId: otherSchoolId, firstName: 'X', lastName: 'Y' },
        office.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const otherStudent = await factory.student(otherSchoolId);
    await expect(
      h.schoolStudents.getStudentDetails(
        { schoolId: otherSchoolId, studentId: otherStudent },
        office.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permits intake but blocks decision injection and redacts private admission data', async () => {
    const schoolId = await factory.school();
    const office = await factory.user();
    await factory.membership(schoolId, office.id, 'ADMIN_STAFF');
    const application = await admissions.createApplication(
      { schoolId, firstName: 'Anne', lastName: 'Test', parentPhone: '123' },
      office.id,
      null,
    );
    await admissions.updateApplication(
      application.id,
      { schoolId, parentPhone: '456' },
      office.id,
      null,
    );
    await pool.query(
      'UPDATE admission_applications SET notes=$2, registration_payment_notes=$2, registration_fee_amount=999 WHERE id=$1',
      [application.id, 'PRIVATE_ADMISSION_MARKER'],
    );
    const details = await admissions.getApplicationDetails(
      { schoolId, admissionApplicationId: application.id },
      office.id,
      null,
    );
    expect(details.parent.phone).toBe('456');
    expect(details.registrationFee.amount).toBeNull();
    expect(JSON.stringify(details)).not.toContain('PRIVATE_ADMISSION_MARKER');
    await expect(
      admissions.createApplication(
        {
          schoolId,
          firstName: 'X',
          lastName: 'Y',
          admissionStatus: 'ADMITTED',
        },
        office.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      admissions.updateApplication(
        application.id,
        { schoolId, notes: 'restricted' },
        office.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      admissions.changeApplicationStatus(
        application.id,
        { schoolId, admissionStatus: 'ADMITTED' } as never,
        office.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cannot administer users or finance and loses access when suspended', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    const office = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const membershipId = await factory.membership(
      schoolId,
      office.id,
      'ADMIN_STAFF',
    );
    await expect(
      h.invitations.createInvitation(
        { schoolId, email: 'escalation@role.test', roleCode: 'SCHOOL_ADMIN' },
        office.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      h.invitations.listSchoolUsers(schoolId, office.id, null),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      h.access.assertFinancePermission(office.id, schoolId, 'PAYROLL_VIEW'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const session = await factory.session(office.id);
    await h.invitations.updateSchoolMembershipStatus(
      membershipId,
      { schoolId, membershipStatus: 'SUSPENDED' },
      admin.id,
      null,
    );
    await expect(
      h.auth.requireSession(`Bearer ${session.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      h.schoolStudents.createStudent(
        { schoolId, firstName: 'X', lastName: 'Y' },
        office.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
