import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

function invitationToken(url: string | undefined) {
  const token = url?.split('#token=')[1];
  if (!token) {
    throw new Error('Captured invitation URL did not contain a token.');
  }
  return decodeURIComponent(token);
}

describe('staff account access lifecycle integration', () => {
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
    harness.email.reset();
  });

  afterAll(async () => {
    await harness.close();
    await pool.end();
  });

  async function administrator(schoolId: string) {
    const user = await factory.user();
    await factory.membership(schoolId, user.id, 'SCHOOL_ADMIN');
    const staff = await pool.query<{ id: string; row_version: number }>(
      `
      SELECT id, row_version
      FROM school_staff_accounts
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      `,
      [schoolId, user.id],
    );
    return { ...user, staff: staff.rows[0] };
  }

  async function addRoleWithoutStaff(
    schoolId: string,
    userId: string,
    roleCode: 'TEACHER' | 'FINANCE_ADMIN',
  ) {
    const membershipId = await factory.membership(schoolId, userId, 'PARENT');
    await pool.query(
      `
      INSERT INTO school_membership_roles (
        school_membership_id,
        role
      )
      VALUES ($1, $2::school_staff_role)
      `,
      [membershipId, roleCode],
    );
    await pool.query(
      `
      INSERT INTO school_user_roles (
        school_id,
        user_id,
        role,
        is_primary
      )
      VALUES ($1, $2, $3::school_role, FALSE)
      `,
      [schoolId, userId, roleCode],
    );
  }

  it('invites access from an active staff record and audits activation', async () => {
    const schoolId = await factory.school({ name: 'Staff Access Academy' });
    const admin = await administrator(schoolId);
    const staff = await harness.staffManagement.createStaff(
      {
        schoolId,
        firstName: 'Nadine',
        lastName: 'Joseph',
        email: 'nadine.joseph@release.test',
        staffCategory: 'TEACHING',
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        jobTitle: 'Mathematics Teacher',
        reason: 'Teacher employment approved.',
      },
      admin.id,
    );

    const invitation = await harness.staffManagement.createStaffInvitation(
      staff.id,
      {
        schoolId,
        roleCode: 'TEACHER',
        locale: 'en',
      },
      admin.id,
    );

    expect(invitation).toMatchObject({ emailSent: true });
    expect(JSON.stringify(invitation)).not.toContain('token');
    const pending = await pool.query<{
      staff_account_id: string;
      email_normalized: string;
      role_code: string;
    }>(
      `
      SELECT staff_account_id, email_normalized, role_code
      FROM user_invitations
      WHERE id = $1
      `,
      [invitation.invitationId],
    );
    expect(pending.rows[0]).toEqual({
      staff_account_id: staff.id,
      email_normalized: 'nadine.joseph@release.test',
      role_code: 'TEACHER',
    });

    const token = invitationToken(harness.email.invitations[0]?.activationUrl);
    const password = 'Quiet Harbor 97!Copper Lantern';
    const accepted = await harness.invitations.acceptInvitation({
      token,
      firstName: 'Nadine',
      lastName: 'Joseph',
      password,
      passwordConfirmation: password,
    });

    const linked = await pool.query<{
      id: string;
      user_id: string;
      staff_type: string;
    }>(
      `
      SELECT id, user_id, staff_type
      FROM school_staff_accounts
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      `,
      [schoolId, accepted.userId],
    );
    expect(linked.rows).toEqual([
      {
        id: staff.id,
        user_id: accepted.userId,
        staff_type: 'TEACHER',
      },
    ]);
    const events = await pool.query<{
      event_type: string;
      invitation_id: string | null;
    }>(
      `
      SELECT event_type, invitation_id
      FROM staff_account_user_link_events
      WHERE staff_account_id = $1
      `,
      [staff.id],
    );
    expect(events.rows).toEqual([
      {
        event_type: 'LINKED',
        invitation_id: invitation.invitationId,
      },
    ]);
    await expect(
      pool.query(
        `
        UPDATE staff_account_user_link_events
        SET reason = 'Tampered'
        WHERE staff_account_id = $1
        `,
        [staff.id],
      ),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('links an existing member, revokes sessions, and unlinks without losing history', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const teacher = await factory.user({
      email: 'existing.teacher@release.test',
    });
    await addRoleWithoutStaff(schoolId, teacher.id, 'TEACHER');
    const staff = await harness.staffManagement.createStaff(
      {
        schoolId,
        firstName: 'Existing',
        lastName: 'Teacher',
        email: teacher.email,
        staffCategory: 'TEACHING',
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        reason: 'Employment approved before system access.',
      },
      admin.id,
    );
    const sessionBeforeLink = await factory.session(teacher.id);

    const linked = await harness.staffManagement.linkStaffUser(
      staff.id,
      {
        schoolId,
        userId: teacher.id,
        roleCode: 'TEACHER',
        rowVersion: staff.rowVersion,
        reason: 'Existing verified account matched to employment record.',
      },
      admin.id,
    );
    expect(linked).toMatchObject({
      linked: true,
      userId: teacher.id,
      sessionsRevoked: 1,
    });
    const revokedAfterLink = await pool.query<{ revoked_at: string | null }>(
      'SELECT revoked_at FROM auth_sessions WHERE id = $1',
      [sessionBeforeLink.id],
    );
    expect(revokedAfterLink.rows[0].revoked_at).toBeTruthy();

    const scope = await factory.academicScope(schoolId);
    const assignmentId = await factory.teacherAssignment(
      schoolId,
      teacher.id,
      scope,
      admin.id,
    );
    await pool.query(
      `
      UPDATE teacher_academic_assignments
      SET assignment_status = 'ARCHIVED', deleted_at = NOW()
      WHERE id = $1
      `,
      [assignmentId],
    );
    const sessionBeforeUnlink = await factory.session(teacher.id);
    const unlinked = await harness.staffManagement.unlinkStaffUser(
      staff.id,
      {
        schoolId,
        rowVersion: linked.rowVersion,
        reason: 'Interactive system access is no longer required.',
      },
      admin.id,
    );
    expect(unlinked).toMatchObject({
      linked: false,
      formerUserId: teacher.id,
      sessionsRevoked: 1,
    });

    const state = await pool.query<{
      user_id: string | null;
      staff_type: string | null;
      membership_status: string;
      parent_roles: string;
      teacher_roles: string;
      assignment_owner: string;
      revoked_at: string | null;
    }>(
      `
      SELECT
        staff.user_id,
        staff.staff_type,
        membership.membership_status,
        COUNT(role.id) FILTER (
          WHERE role.role::TEXT = 'PARENT'
            AND role.deleted_at IS NULL
        )::TEXT AS parent_roles,
        COUNT(role.id) FILTER (
          WHERE role.role::TEXT = 'TEACHER'
            AND role.deleted_at IS NULL
        )::TEXT AS teacher_roles,
        assignment.teacher_user_id AS assignment_owner,
        session.revoked_at
      FROM school_staff_accounts staff
      JOIN school_memberships membership
        ON membership.school_id = staff.school_id
       AND membership.user_id = $3
       AND membership.deleted_at IS NULL
      LEFT JOIN school_membership_roles role
        ON role.school_membership_id = membership.id
      JOIN teacher_academic_assignments assignment
        ON assignment.id = $4
      JOIN auth_sessions session
        ON session.id = $5
      WHERE staff.id = $1
        AND staff.school_id = $2
      GROUP BY
        staff.user_id,
        staff.staff_type,
        membership.membership_status,
        assignment.teacher_user_id,
        session.revoked_at
      `,
      [staff.id, schoolId, teacher.id, assignmentId, sessionBeforeUnlink.id],
    );
    expect(state.rows[0]).toMatchObject({
      user_id: null,
      staff_type: null,
      membership_status: 'ACTIVE',
      parent_roles: '1',
      teacher_roles: '0',
      assignment_owner: teacher.id,
    });
    expect(state.rows[0].revoked_at).toBeTruthy();
    const events = await pool.query<{ event_type: string }>(
      `
      SELECT event_type
      FROM staff_account_user_link_events
      WHERE staff_account_id = $1
      ORDER BY created_at
      `,
      [staff.id],
    );
    expect(events.rows.map((row) => row.event_type)).toEqual([
      'LINKED',
      'UNLINKED',
    ]);
  });

  it('rejects unlinking while protected assignments or payroll remain active', async () => {
    const schoolId = await factory.school();
    const admin = await administrator(schoolId);
    const teacher = await factory.user();
    await factory.membership(schoolId, teacher.id, 'TEACHER');
    const staff = await pool.query<{ id: string; row_version: number }>(
      `
      SELECT id, row_version
      FROM school_staff_accounts
      WHERE school_id = $1 AND user_id = $2 AND deleted_at IS NULL
      `,
      [schoolId, teacher.id],
    );
    const scope = await factory.academicScope(schoolId);
    const assignmentId = await factory.teacherAssignment(
      schoolId,
      teacher.id,
      scope,
      admin.id,
    );
    const session = await factory.session(teacher.id);

    await expect(
      harness.staffManagement.unlinkStaffUser(
        staff.rows[0].id,
        {
          schoolId,
          rowVersion: staff.rows[0].row_version,
          reason: 'Attempted unsafe unlink.',
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await pool.query(
      `
      UPDATE teacher_academic_assignments
      SET assignment_status = 'ARCHIVED', deleted_at = NOW()
      WHERE id = $1
      `,
      [assignmentId],
    );
    await pool.query(
      `
      INSERT INTO payroll_staff_profiles (
        school_id,
        school_staff_account_id,
        full_name,
        base_salary,
        currency_code,
        payroll_active
      )
      VALUES ($1, $2, 'Protected Teacher', 50000, 'HTG', TRUE)
      `,
      [schoolId, staff.rows[0].id],
    );
    await expect(
      harness.staffManagement.unlinkStaffUser(
        staff.rows[0].id,
        {
          schoolId,
          rowVersion: staff.rows[0].row_version,
          reason: 'Attempted unlink with active payroll.',
        },
        admin.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const unchanged = await pool.query<{
      user_id: string;
      revoked_at: string | null;
    }>(
      `
      SELECT staff.user_id, session.revoked_at
      FROM school_staff_accounts staff
      JOIN auth_sessions session ON session.id = $2
      WHERE staff.id = $1
      `,
      [staff.rows[0].id, session.id],
    );
    expect(unchanged.rows[0]).toEqual({
      user_id: teacher.id,
      revoked_at: null,
    });
  });

  it('rejects self/final-admin unlinking and cross-school management', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const firstAdmin = await administrator(firstSchoolId);
    const secondAdmin = await administrator(secondSchoolId);

    await expect(
      harness.staffManagement.unlinkStaffUser(
        firstAdmin.staff.id,
        {
          schoolId: firstSchoolId,
          rowVersion: firstAdmin.staff.row_version,
          reason: 'Attempted final administrator unlink.',
        },
        firstAdmin.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      harness.staffManagement.createStaffInvitation(
        firstAdmin.staff.id,
        {
          schoolId: firstSchoolId,
          roleCode: 'TEACHER',
        },
        secondAdmin.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
