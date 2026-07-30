import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { InvitationsService } from '../src/auth/invitations.service';
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

describe('secure invitation and membership integration', () => {
  let pool: Pool;
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let factory: IntegrationFactory;
  let invitations: InvitationsService;

  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    invitations = harness.invitations;
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

  it('activates a teacher invitation once and creates the staff profile', async () => {
    const schoolId = await factory.school({ name: 'Pilot Academy' });
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');

    const created = await invitations.createInvitation(
      {
        schoolId,
        email: 'teacher.one@release.test',
        roleCode: 'TEACHER',
        locale: 'en',
        firstName: 'Aurelie',
        lastName: 'Pierre',
        staffCode: 'T-001',
        jobTitle: 'Mathematics Teacher',
      },
      admin.id,
      null,
    );

    expect(created.emailSent).toBe(true);
    expect(created).not.toHaveProperty('token');
    const token = invitationToken(
      harness.email.invitations[0]?.activationUrl,
    );
    const password = 'Night Harbor 94!Velvet Compass';

    const accepted = await invitations.acceptInvitation({
      token,
      firstName: 'Aurelie',
      lastName: 'Pierre',
      password,
      passwordConfirmation: password,
    });

    expect(accepted).toMatchObject({
      activated: true,
      schoolId,
    });

    const staff = await pool.query<{
      staff_code: string | null;
      staff_type: string;
    }>(
      `
      SELECT staff_code, staff_type
      FROM school_staff_accounts
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      `,
      [schoolId, accepted.userId],
    );
    expect(staff.rows).toEqual([
      {
        staff_code: 'T-001',
        staff_type: 'TEACHER',
      },
    ]);

    await expect(
      invitations.acceptInvitation({
        token,
        firstName: 'Aurelie',
        lastName: 'Pierre',
        password,
        passwordConfirmation: password,
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('links an invitation to the designated offline staff record', async () => {
    const schoolId = await factory.school({ name: 'Staff Link Academy' });
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const offline = await pool.query<{ id: string }>(
      `
      INSERT INTO school_staff_accounts (
        school_id,
        first_name,
        last_name,
        email_original,
        staff_category,
        employment_type,
        employment_status
      )
      VALUES (
        $1,
        'Nadine',
        'Joseph',
        'nadine.joseph@release.test',
        'TEACHING',
        'FULL_TIME',
        'DRAFT'
      )
      RETURNING id
      `,
      [schoolId],
    );
    const staffAccountId = offline.rows[0].id;

    await invitations.createInvitation(
      {
        schoolId,
        staffAccountId,
        email: 'nadine.joseph@release.test',
        roleCode: 'TEACHER',
        firstName: 'Nadine',
        lastName: 'Joseph',
        locale: 'en',
      },
      admin.id,
      null,
    );
    const token = invitationToken(
      harness.email.invitations[0]?.activationUrl,
    );
    const password = 'Copper Harbor 87!Quiet Lantern';
    const accepted = await invitations.acceptInvitation({
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
      employment_status: string;
    }>(
      `
      SELECT id, user_id, staff_type, employment_status
      FROM school_staff_accounts
      WHERE school_id = $1
        AND (id = $2 OR user_id = $3)
        AND deleted_at IS NULL
      `,
      [schoolId, staffAccountId, accepted.userId],
    );
    expect(linked.rows).toEqual([
      {
        id: staffAccountId,
        user_id: accepted.userId,
        staff_type: 'TEACHER',
        employment_status: 'DRAFT',
      },
    ]);
  });
  it('enforces role-grant and school boundaries on invitation creation', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const admin = await factory.user();
    const teacher = await factory.user();
    await factory.membership(firstSchoolId, admin.id, 'SCHOOL_ADMIN');
    await factory.membership(firstSchoolId, teacher.id, 'TEACHER');

    await expect(
      invitations.createInvitation(
        {
          schoolId: firstSchoolId,
          email: 'stronger-role@release.test',
          roleCode: 'SCHOOL_ADMIN',
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      invitations.createInvitation(
        {
          schoolId: firstSchoolId,
          email: 'unauthorized@release.test',
          roleCode: 'TEACHER',
        },
        teacher.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      invitations.createInvitation(
        {
          schoolId: secondSchoolId,
          email: 'cross-school@release.test',
          roleCode: 'TEACHER',
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires parent guardians to belong to the invited school', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(firstSchoolId, admin.id, 'SCHOOL_ADMIN');
    const foreignGuardianId = await factory.guardian(secondSchoolId);

    await expect(
      invitations.createInvitation(
        {
          schoolId: firstSchoolId,
          email: 'parent@release.test',
          roleCode: 'PARENT',
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      invitations.createInvitation(
        {
          schoolId: firstSchoolId,
          email: 'parent@release.test',
          roleCode: 'PARENT',
          guardianId: foreignGuardianId,
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('links an activated parent to the selected guardian', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const guardianId = await factory.guardian(schoolId, {
      email: 'parent.linked@release.test',
    });

    await invitations.createInvitation(
      {
        schoolId,
        email: 'parent.linked@release.test',
        roleCode: 'PARENT',
        guardianId,
        locale: 'en',
      },
      admin.id,
      null,
    );
    const token = invitationToken(
      harness.email.invitations[0]?.activationUrl,
    );
    const password = 'Cobalt Lantern 73!Ocean Bridge';
    const accepted = await invitations.acceptInvitation({
      token,
      firstName: 'Marie',
      lastName: 'Louis',
      password,
      passwordConfirmation: password,
    });

    const links = await pool.query<{ guardian_id: string }>(
      `
      SELECT guardian_id
      FROM guardian_account_links
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      `,
      [schoolId, accepted.userId],
    );
    expect(links.rows.map((row) => row.guardian_id)).toEqual([guardianId]);
  });

  it('applies safe default finance permissions without payroll access', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');

    await invitations.createInvitation(
      {
        schoolId,
        email: 'finance@release.test',
        roleCode: 'FINANCE_ADMIN',
        locale: 'en',
      },
      admin.id,
      null,
    );
    const token = invitationToken(
      harness.email.invitations[0]?.activationUrl,
    );
    const password = 'Amber Current 82!Silver Compass';
    const accepted = await invitations.acceptInvitation({
      token,
      firstName: 'Finance',
      lastName: 'Officer',
      password,
      passwordConfirmation: password,
    });

    const permissionResult = await pool.query<{ permission_code: string }>(
      `
      SELECT permission_code
      FROM school_user_permissions
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      ORDER BY permission_code
      `,
      [schoolId, accepted.userId],
    );
    const codes = permissionResult.rows.map((row) => row.permission_code);

    expect(codes).toContain('FINANCE_PAYMENTS_RECORD');
    expect(codes).not.toContain('PAYROLL_VIEW');
    expect(codes).not.toContain('PAYROLL_MANAGE');

    await expect(
      invitations.createInvitation(
        {
          schoolId,
          email: 'teacher-with-finance@release.test',
          roleCode: 'TEACHER',
          financePermissionCodes: ['FINANCE_INVOICES_VIEW'],
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rotates tokens on resend, increments send_count, and invalidates revoked links', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');

    const created = await invitations.createInvitation(
      {
        schoolId,
        email: 'resend@release.test',
        roleCode: 'TEACHER',
      },
      admin.id,
      null,
    );
    const firstToken = invitationToken(
      harness.email.invitations[0]?.activationUrl,
    );
    await invitations.resendInvitation(created.invitationId, admin.id, null);
    const secondToken = invitationToken(
      harness.email.invitations[1]?.activationUrl,
    );

    expect(secondToken).not.toBe(firstToken);
    await expect(
      invitations.inspectInvitation(firstToken),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      invitations.inspectInvitation(secondToken),
    ).resolves.toMatchObject({ valid: true });

    const invitation = await pool.query<{ send_count: number }>(
      'SELECT send_count FROM user_invitations WHERE id = $1',
      [created.invitationId],
    );
    expect(invitation.rows[0].send_count).toBe(2);

    await invitations.revokeInvitation(created.invitationId, admin.id, null);
    await expect(
      invitations.inspectInvitation(secondToken),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('suspends and reactivates a membership while invalidating sessions', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    const teacher = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const teacherMembershipId = await factory.membership(
      schoolId,
      teacher.id,
      'TEACHER',
    );
    const teacherSession = await factory.session(teacher.id);

    await expect(
      invitations.updateSchoolMembershipStatus(
        teacherMembershipId,
        { schoolId, membershipStatus: 'SUSPENDED' },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({
      membershipStatus: 'SUSPENDED',
      sessionsRevoked: true,
    });
    await expect(
      harness.auth.requireSession(`Bearer ${teacherSession.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      invitations.updateSchoolMembershipStatus(
        teacherMembershipId,
        { schoolId, membershipStatus: 'ACTIVE' },
        admin.id,
        null,
      ),
    ).resolves.toMatchObject({ membershipStatus: 'ACTIVE' });
  });

  it('rejects self-suspension, final-admin suspension, and tampered school IDs', async () => {
    const firstSchoolId = await factory.school();
    const secondSchoolId = await factory.school();
    const admin = await factory.user();
    const superAdmin = await factory.user({ platformRole: 'SUPER_ADMIN' });
    const adminMembershipId = await factory.membership(
      firstSchoolId,
      admin.id,
      'SCHOOL_ADMIN',
    );

    await expect(
      invitations.updateSchoolMembershipStatus(
        adminMembershipId,
        { schoolId: firstSchoolId, membershipStatus: 'SUSPENDED' },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      invitations.updateSchoolMembershipStatus(
        adminMembershipId,
        { schoolId: firstSchoolId, membershipStatus: 'SUSPENDED' },
        superAdmin.id,
        'SUPER_ADMIN',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      invitations.updateSchoolMembershipStatus(
        adminMembershipId,
        { schoolId: secondSchoolId, membershipStatus: 'SUSPENDED' },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('never returns credential material in user-management listings', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    await invitations.createInvitation(
      {
        schoolId,
        email: 'listed@release.test',
        roleCode: 'TEACHER',
      },
      admin.id,
      null,
    );

    const result = await invitations.listSchoolUsers(
      schoolId,
      admin.id,
      null,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /password|token_hash|sessionToken|authentication_version/i,
    );
  });
});
