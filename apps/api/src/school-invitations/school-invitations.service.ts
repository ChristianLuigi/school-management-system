import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { hashPassword } from '../internal-auth/password.util';

type InvitationRow = {
  id: string;
  school_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  invited_role: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';
  invitation_status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expires_at: string;
  created_at: string;
  school_code: string;
  school_name: string;
};

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

@Injectable()
export class SchoolInvitationsService {
  constructor(private readonly db: DbService) {}

  async resolve(token: string) {
    const invitation = await this.findInvitationByToken(token);

    this.ensureInvitationAcceptable(invitation);

    return {
      invitationId: invitation.id,
      school: {
        id: invitation.school_id,
        code: invitation.school_code,
        name: invitation.school_name,
      },
      invitedUser: {
        email: invitation.email,
        firstName: invitation.first_name,
        lastName: invitation.last_name,
      },
      role: invitation.invited_role,
      expiresAt: invitation.expires_at,
      status: invitation.invitation_status,
    };
  }

  async accept(token: string, password: string) {
    const trimmedPassword = password.trim();

    if (trimmedPassword.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long.',
      );
    }

    return this.db.withTransaction(async (client) => {
      const invitation = await this.findInvitationByTokenForUpdate(
        client,
        token,
      );

      this.ensureInvitationAcceptable(invitation);

      const passwordHash = hashPassword(trimmedPassword);
      const user = await this.findOrCreateUserFromInvitation(
        client,
        invitation,
        passwordHash,
      );

      const membershipId = await this.findOrCreateMembership(
        client,
        invitation.school_id,
        user.id,
      );

      await this.ensureMembershipRole(
        client,
        membershipId,
        invitation.invited_role,
      );

      await this.ensureLegacySchoolUserRole(
        client,
        invitation.school_id,
        user.id,
        invitation.invited_role,
      );

      await client.query(
        `
        UPDATE school_invitations
        SET
          invitation_status = 'ACCEPTED',
          accepted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        `,
        [invitation.id],
      );

      return {
        invitationId: invitation.id,
        schoolId: invitation.school_id,
        userId: user.id,
        membershipId,
        role: invitation.invited_role,
        status: 'ACCEPTED' as const,
      };
    });
  }

  private async findInvitationByToken(token: string): Promise<InvitationRow> {
    const tokenHash = this.hashToken(token);

    const result = await this.db.query<InvitationRow>(
      `
      SELECT
        si.id,
        si.school_id,
        si.email,
        si.first_name,
        si.last_name,
        si.invited_role,
        si.invitation_status,
        si.expires_at,
        si.created_at,
        s.code AS school_code,
        s.name AS school_name
      FROM school_invitations si
      JOIN schools s ON s.id = si.school_id
      WHERE si.token_hash = $1
        AND si.deleted_at IS NULL
        AND s.deleted_at IS NULL
      LIMIT 1
      `,
      [tokenHash],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException('Invitation not found.');
    }

    return row;
  }

  private async findInvitationByTokenForUpdate(
    client: PoolClient,
    token: string,
  ): Promise<InvitationRow> {
    const tokenHash = this.hashToken(token);

    const result = await client.query<InvitationRow>(
      `
      SELECT
        si.id,
        si.school_id,
        si.email,
        si.first_name,
        si.last_name,
        si.invited_role,
        si.invitation_status,
        si.expires_at,
        si.created_at,
        s.code AS school_code,
        s.name AS school_name
      FROM school_invitations si
      JOIN schools s ON s.id = si.school_id
      WHERE si.token_hash = $1
        AND si.deleted_at IS NULL
        AND s.deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [tokenHash],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException('Invitation not found.');
    }

    return row;
  }

  private ensureInvitationAcceptable(invitation: InvitationRow) {
    if (invitation.invitation_status !== 'PENDING') {
      throw new BadRequestException(
        `Invitation is ${invitation.invitation_status.toLowerCase()} and cannot be accepted.`,
      );
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      throw new BadRequestException('Invitation has expired.');
    }
  }

  private async findOrCreateUserFromInvitation(
    client: PoolClient,
    invitation: InvitationRow,
    passwordHash: string,
  ): Promise<UserRow> {
    const normalizedEmail = invitation.email.trim().toLowerCase();

    const existingUserResult = await client.query<UserRow>(
      `
      SELECT id, first_name, last_name
      FROM users
      WHERE email = $1
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [normalizedEmail],
    );

    const existingUser = existingUserResult.rows[0];

    if (existingUser) {
      const updateResult = await client.query<UserRow>(
        `
        UPDATE users
        SET
          password_hash = $2,
          first_name = COALESCE(users.first_name, $3),
          last_name = COALESCE(users.last_name, $4),
          status = 'ACTIVE',
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, first_name, last_name
        `,
        [
          existingUser.id,
          passwordHash,
          invitation.first_name,
          invitation.last_name,
        ],
      );

      return updateResult.rows[0];
    }

    const insertResult = await client.query<UserRow>(
      `
      INSERT INTO users (
        email,
        password_hash,
        preferred_locale,
        status,
        first_name,
        last_name
      )
      VALUES ($1, $2, 'fr', 'ACTIVE', $3, $4)
      RETURNING id, first_name, last_name
      `,
      [
        normalizedEmail,
        passwordHash,
        invitation.first_name,
        invitation.last_name,
      ],
    );

    return insertResult.rows[0];
  }

  private async findOrCreateMembership(
    client: PoolClient,
    schoolId: string,
    userId: string,
  ): Promise<string> {
    const existingMembershipResult = await client.query<{ id: string }>(
      `
      SELECT id
      FROM school_memberships
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [schoolId, userId],
    );

    const existingMembership = existingMembershipResult.rows[0];

    if (existingMembership) {
      await client.query(
        `
        UPDATE school_memberships
        SET
          membership_status = 'ACTIVE',
          joined_at = COALESCE(joined_at, NOW()),
          activated_at = NOW(),
          suspended_at = NULL,
          updated_at = NOW()
        WHERE id = $1
        `,
        [existingMembership.id],
      );

      return existingMembership.id;
    }

    const insertedMembership = await client.query<{ id: string }>(
      `
      INSERT INTO school_memberships (
        school_id,
        user_id,
        membership_status,
        invited_at,
        joined_at,
        activated_at,
        is_primary
      )
      VALUES ($1, $2, 'ACTIVE', NOW(), NOW(), NOW(), TRUE)
      RETURNING id
      `,
      [schoolId, userId],
    );

    return insertedMembership.rows[0].id;
  }

  private async ensureMembershipRole(
    client: PoolClient,
    schoolMembershipId: string,
    role: InvitationRow['invited_role'],
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO school_membership_roles (
        school_membership_id,
        role
      )
      VALUES ($1, $2::school_staff_role)
      ON CONFLICT DO NOTHING
      `,
      [schoolMembershipId, role],
    );
  }

  private async ensureLegacySchoolUserRole(
    client: PoolClient,
    schoolId: string,
    userId: string,
    role: InvitationRow['invited_role'],
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO school_user_roles (
        school_id,
        user_id,
        role,
        is_primary
      )
      VALUES ($1, $2, $3::school_role, TRUE)
      ON CONFLICT (school_id, user_id, role) DO NOTHING
      `,
      [schoolId, userId, role],
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }
}
