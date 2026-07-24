import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AccessManagementService } from '../src/access-management/access-management.service';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('operational scope integration', () => {
  let pool: Pool;
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let factory: IntegrationFactory;
  let access: AccessManagementService;

  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    access = harness.access;
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

  it('restricts teachers to assigned sections and subjects and revokes sessions on change', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    const teacher = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    await factory.membership(schoolId, teacher.id, 'TEACHER');
    const assignedScope = await factory.academicScope(schoolId);
    const otherScope = await factory.academicScope(schoolId);
    const session = await factory.session(teacher.id);

    await expect(
      access.updateTeacherAssignments(
        teacher.id,
        {
          schoolId,
          academicYearId: assignedScope.academicYearId,
          assignments: [
            {
              sectionId: assignedScope.sectionId,
              subjectId: assignedScope.subjectId,
            },
            {
              sectionId: assignedScope.sectionId,
              subjectId: assignedScope.subjectId,
            },
          ],
        },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({
      assignmentCount: 1,
      sessionsRevoked: true,
    });

    await expect(
      access.assertTeacherAssignment(
        teacher.id,
        schoolId,
        assignedScope.academicYearId,
        assignedScope.sectionId,
        assignedScope.subjectId,
      ),
    ).resolves.toBeUndefined();
    await expect(
      access.assertTeacherAssignment(
        teacher.id,
        schoolId,
        otherScope.academicYearId,
        otherScope.sectionId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      access.assertTeacherAssignment(
        teacher.id,
        schoolId,
        assignedScope.academicYearId,
        assignedScope.sectionId,
        otherScope.subjectId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      harness.auth.requireSession(`Bearer ${session.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects cross-school teacher assignment changes', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const admin = await factory.user();
    const teacher = await factory.user();
    await factory.membership(firstSchoolId, admin.id, 'SCHOOL_ADMIN');
    await factory.membership(secondSchoolId, teacher.id, 'TEACHER');
    const secondScope = await factory.academicScope(secondSchoolId);

    await expect(
      access.updateTeacherAssignments(
        teacher.id,
        {
          schoolId: secondSchoolId,
          academicYearId: secondScope.academicYearId,
          assignments: [
            {
              sectionId: secondScope.sectionId,
              subjectId: secondScope.subjectId,
            },
          ],
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces explicit finance permissions and active membership', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    const financeUser = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const financeMembershipId = await factory.membership(
      schoolId,
      financeUser.id,
      'FINANCE_ADMIN',
    );
    const session = await factory.session(financeUser.id);

    const result = await access.updateFinancePermissions(
      financeUser.id,
      {
        schoolId,
        permissionCodes: [
          'FINANCE_INVOICES_VIEW',
          'FINANCE_PAYMENTS_RECORD',
        ],
      },
      admin.id,
      null,
    );

    expect(result.permissionCodes).toEqual([
      'FINANCE_INVOICES_VIEW',
      'FINANCE_PAYMENTS_RECORD',
    ]);
    await expect(
      access.assertFinancePermission(
        financeUser.id,
        schoolId,
        'FINANCE_PAYMENTS_RECORD',
      ),
    ).resolves.toBeUndefined();
    await expect(
      access.assertFinancePermission(
        financeUser.id,
        schoolId,
        'PAYROLL_VIEW',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      harness.auth.requireSession(`Bearer ${session.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await pool.query(
      `
      UPDATE school_memberships
      SET membership_status = 'SUSPENDED'
      WHERE id = $1
      `,
      [financeMembershipId],
    );
    await expect(
      access.assertFinancePermission(
        financeUser.id,
        schoolId,
        'FINANCE_INVOICES_VIEW',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limits parent access to students reached through active guardian links', async () => {
    const schoolId = await factory.school();
    const foreignSchoolId = await factory.school();
    const admin = await factory.user();
    const parent = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    await factory.membership(schoolId, parent.id, 'PARENT');
    const linkedGuardianId = await factory.guardian(schoolId);
    const unlinkedGuardianId = await factory.guardian(schoolId);
    const foreignGuardianId = await factory.guardian(foreignSchoolId);
    const linkedStudentId = await factory.student(schoolId);
    const unlinkedStudentId = await factory.student(schoolId);
    await factory.studentGuardian(
      schoolId,
      linkedStudentId,
      linkedGuardianId,
    );
    await factory.studentGuardian(
      schoolId,
      unlinkedStudentId,
      unlinkedGuardianId,
    );
    const session = await factory.session(parent.id);

    await expect(
      access.updateParentGuardianLinks(
        parent.id,
        { schoolId, guardianIds: [foreignGuardianId] },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      access.updateParentGuardianLinks(
        parent.id,
        { schoolId, guardianIds: [linkedGuardianId, linkedGuardianId] },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({
      guardianIds: [linkedGuardianId],
      sessionsRevoked: true,
    });

    await expect(
      access.getParentStudentIds(parent.id, schoolId),
    ).resolves.toEqual([linkedStudentId]);
    await expect(
      access.assertParentStudent(parent.id, schoolId, linkedStudentId),
    ).resolves.toBeUndefined();
    await expect(
      access.assertParentStudent(parent.id, schoolId, unlinkedStudentId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      access.assertParentStudent(parent.id, schoolId, foreignGuardianId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      harness.auth.requireSession(`Bearer ${session.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
