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

describe('canonical teacher staff assignments', () => {
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

  async function teachingStaff(
    schoolId: string,
    actorUserId: string,
    status = 'ACTIVE',
  ) {
    const result = await pool.query<{ id: string }>(
      `
      INSERT INTO school_staff_accounts (
        school_id,
        first_name,
        last_name,
        staff_category,
        employment_type,
        employment_status,
        hire_date,
        created_by_user_id
      )
      VALUES ($1, 'Offline', 'Teacher', 'TEACHING', 'FULL_TIME', $2, CURRENT_DATE, $3)
      RETURNING id
      `,
      [schoolId, status, actorUserId],
    );
    return result.rows[0].id;
  }

  async function addTeacherMembership(schoolId: string, userId: string) {
    const membership = await pool.query<{ id: string }>(
      `
      INSERT INTO school_memberships (
        school_id,
        user_id,
        membership_status,
        joined_at,
        activated_at
      )
      VALUES ($1, $2, 'ACTIVE', NOW(), NOW())
      RETURNING id
      `,
      [schoolId, userId],
    );
    await pool.query(
      `
      INSERT INTO school_membership_roles (
        school_membership_id,
        role
      )
      VALUES ($1, 'TEACHER')
      `,
      [membership.rows[0].id],
    );
  }

  it('assigns teaching work before login exists and resolves access through the later linked user', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    const teacher = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const staffAccountId = await teachingStaff(schoolId, admin.id);
    const scope = await factory.academicScope(schoolId);

    await expect(
      access.updateTeacherStaffAssignments(
        staffAccountId,
        {
          schoolId,
          academicYearId: scope.academicYearId,
          assignments: [
            {
              sectionId: scope.sectionId,
              subjectId: scope.subjectId,
            },
          ],
        },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({
      staffAccountId,
      teacherUserId: null,
      assignmentCount: 1,
      sessionsRevoked: false,
    });

    const assignment = await pool.query<{
      teacher_staff_account_id: string;
      teacher_user_id: string | null;
    }>(
      `
      SELECT teacher_staff_account_id, teacher_user_id
      FROM teacher_academic_assignments
      WHERE school_id = $1
        AND teacher_staff_account_id = $2
        AND deleted_at IS NULL
      `,
      [schoolId, staffAccountId],
    );
    expect(assignment.rows[0]).toEqual({
      teacher_staff_account_id: staffAccountId,
      teacher_user_id: null,
    });

    await expect(
      access.assertTeacherAssignment(
        teacher.id,
        schoolId,
        scope.academicYearId,
        scope.sectionId,
        scope.subjectId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await addTeacherMembership(schoolId, teacher.id);
    await pool.query(
      `
      UPDATE school_staff_accounts
      SET user_id = $3, staff_type = 'TEACHER'
      WHERE id = $1 AND school_id = $2
      `,
      [staffAccountId, schoolId, teacher.id],
    );

    await expect(
      access.assertTeacherAssignment(
        teacher.id,
        schoolId,
        scope.academicYearId,
        scope.sectionId,
        scope.subjectId,
      ),
    ).resolves.toBeUndefined();

    const session = await factory.session(teacher.id);
    await expect(
      access.updateTeacherStaffAssignments(
        staffAccountId,
        {
          schoolId,
          academicYearId: scope.academicYearId,
          assignments: [
            {
              sectionId: scope.sectionId,
              subjectId: scope.subjectId,
            },
          ],
        },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({
      teacherUserId: teacher.id,
      sessionsRevoked: true,
    });
    await expect(
      harness.auth.requireSession(`Bearer ${session.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive, non-teaching, and cross-school assignment targets', async () => {
    const schoolId = await factory.school();
    const otherSchoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const inactiveStaffId = await teachingStaff(
      schoolId,
      admin.id,
      'SUSPENDED',
    );
    const nonTeaching = await pool.query<{ id: string }>(
      `
      INSERT INTO school_staff_accounts (
        school_id,
        first_name,
        last_name,
        staff_category,
        employment_type,
        employment_status,
        hire_date,
        created_by_user_id
      )
      VALUES ($1, 'Office', 'Staff', 'ADMINISTRATIVE', 'FULL_TIME', 'ACTIVE', CURRENT_DATE, $2)
      RETURNING id
      `,
      [schoolId, admin.id],
    );
    const scope = await factory.academicScope(schoolId);

    for (const staffAccountId of [inactiveStaffId, nonTeaching.rows[0].id]) {
      await expect(
        access.updateTeacherStaffAssignments(
          staffAccountId,
          {
            schoolId,
            academicYearId: scope.academicYearId,
            assignments: [],
          },
          admin.id,
          null,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    const otherStaffId = await teachingStaff(otherSchoolId, admin.id);
    await expect(
      access.updateTeacherStaffAssignments(
        otherStaffId,
        {
          schoolId,
          academicYearId: scope.academicYearId,
          assignments: [],
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('automatically removes active scope when teaching employment is suspended', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const staffAccountId = await teachingStaff(schoolId, admin.id);
    const scope = await factory.academicScope(schoolId);
    await access.updateTeacherStaffAssignments(
      staffAccountId,
      {
        schoolId,
        academicYearId: scope.academicYearId,
        assignments: [
          {
            sectionId: scope.sectionId,
            subjectId: scope.subjectId,
          },
        ],
      },
      admin.id,
      null,
    );

    await pool.query(
      `
      UPDATE school_staff_accounts
      SET
        employment_status = 'SUSPENDED',
        status_effective_date = CURRENT_DATE,
        status_reason = 'Integration test suspension.',
        employment_status_changed_by_user_id = $2
      WHERE id = $1
      `,
      [staffAccountId, admin.id],
    );
    const assignment = await pool.query<{ assignment_status: string }>(
      `
      SELECT assignment_status
      FROM teacher_academic_assignments
      WHERE teacher_staff_account_id = $1
        AND deleted_at IS NULL
      `,
      [staffAccountId],
    );
    expect(assignment.rows[0].assignment_status).toBe('SUSPENDED');
  });
});
