import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { EmailService } from '../email/email.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateUserInvitationDto } from './dto/create-user-invitation.dto';
import { UpdateSchoolMembershipStatusDto } from './dto/update-school-membership-status.dto';
import { AuthTokenService } from './security/auth-token.service';
import {
  DEFAULT_FINANCE_PERMISSIONS,
  validateFinancePermissions,
  type FinancePermissionCode,
} from './security/finance-permission-policy';
import { canonicalizeEmail } from './security/email-identity';
import { PasswordService } from './security/password.service';
import {
  ActorRole,
  assertCanGrantRole,
  SchoolRole,
} from './security/role-grant-policy';

type PlatformRole = 'SUPER_ADMIN' | null;
type InvitationRow = {
  id: string;
  school_id: string;
  email_original: string;
  email_normalized: string;
  role_code: SchoolRole;
  locale: 'fr' | 'en';
  invitation_status: string;
  expires_at: Date;
  send_count: number;
  first_name: string | null;
  last_name: string | null;
  school_name: string;
  existing_user_id: string | null;
  invited_by_user_id: string;
  guardian_id: string | null;
  staff_account_id: string | null;
  staff_code: string | null;
  job_title: string | null;
  department: string | null;
  initial_permission_codes: string[];
};

@Injectable()
export class InvitationsService {
  constructor(
    private readonly db: DbService,
    private readonly tokens: AuthTokenService,
    private readonly passwords: PasswordService,
    private readonly email: EmailService,
    private readonly activity: PlatformActivityService,
  ) {}

  private ttlHours() {
    const value = Number(process.env.AUTH_INVITATION_TTL_HOURS ?? 48);
    return Number.isFinite(value) && value > 0 ? value : 48;
  }

  private publicUrl() {
    const value = process.env.APP_PUBLIC_URL?.replace(/\/+$/, '');
    if (!value) throw new Error('APP_PUBLIC_URL is not configured.');
    return value;
  }

  private async actorRoles(
    actorUserId: string,
    schoolId: string,
    platformRole: PlatformRole,
  ): Promise<ActorRole[]> {
    if (platformRole === 'SUPER_ADMIN') return ['SUPER_ADMIN'];
    const result = await this.db.query<{ role: SchoolRole }>(
      `
      SELECT smr.role
      FROM school_memberships sm
      JOIN school_membership_roles smr ON smr.school_membership_id = sm.id
      WHERE sm.school_id = $1 AND sm.user_id = $2
        AND sm.membership_status = 'ACTIVE' AND sm.deleted_at IS NULL AND smr.deleted_at IS NULL
    `,
      [schoolId, actorUserId],
    );
    return result.rows.map((row) => row.role);
  }

  private async authorizeGrant(
    actorUserId: string,
    schoolId: string,
    platformRole: PlatformRole,
    role: SchoolRole,
  ) {
    assertCanGrantRole(
      await this.actorRoles(actorUserId, schoolId, platformRole),
      role,
    );
  }

  private async validateOperationalInvitation(dto: CreateUserInvitationDto) {
    if (dto.roleCode === 'PARENT') {
      if (!dto.guardianId)
        throw new BadRequestException(
          'A parent invitation must be linked to a guardian record.',
        );
      const guardian = await this.db.query<{
        id: string;
        linked_email: string | null;
      }>(
        `
        SELECT g.id,u.email_normalized AS linked_email FROM guardians g
        LEFT JOIN users u ON u.id=g.user_id AND u.deleted_at IS NULL
        WHERE g.id=$1 AND g.school_id=$2 AND g.deleted_at IS NULL LIMIT 1
      `,
        [dto.guardianId, dto.schoolId],
      );
      if (!guardian.rows[0])
        throw new BadRequestException(
          'The selected guardian does not belong to this school.',
        );
      if (
        guardian.rows[0].linked_email &&
        guardian.rows[0].linked_email !==
          canonicalizeEmail(dto.email).normalized
      ) {
        throw new BadRequestException(
          'The selected guardian is already linked to another account.',
        );
      }
      if (dto.staffCode || dto.jobTitle || dto.department) {
        throw new BadRequestException(
          'Staff metadata cannot be assigned to a parent invitation.',
        );
      }
    } else if (dto.guardianId) {
      throw new BadRequestException(
        'A guardian record can only be used for a parent invitation.',
      );
    }
    if (dto.staffAccountId) {
      if (dto.roleCode === 'PARENT') {
        throw new BadRequestException(
          'A parent invitation cannot be linked to a staff record.',
        );
      }
      const staff = await this.db.query<{
        id: string;
        user_id: string | null;
        email_normalized: string | null;
        employment_status: string;
      }>(
        `
        SELECT id, user_id, email_normalized, employment_status
        FROM school_staff_accounts
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.staffAccountId, dto.schoolId],
      );
      const record = staff.rows[0];
      if (!record) {
        throw new BadRequestException(
          'The selected staff record does not belong to this school.',
        );
      }
      if (record.user_id) {
        throw new ConflictException(
          'The selected staff record already has a linked account.',
        );
      }
      if (!['ACTIVE', 'ON_LEAVE'].includes(record.employment_status)) {
        throw new BadRequestException(
          'Only active or on-leave staff can receive an account invitation.',
        );
      }
      if (
        record.email_normalized &&
        record.email_normalized !== canonicalizeEmail(dto.email).normalized
      ) {
        throw new BadRequestException(
          'The invitation email must match the staff record email.',
        );
      }
    }
    if (
      dto.financePermissionCodes?.length &&
      dto.roleCode !== 'FINANCE_ADMIN'
    ) {
      throw new BadRequestException(
        'Finance permissions can only be assigned to a finance administrator.',
      );
    }
    return {
      financePermissions:
        dto.roleCode === 'FINANCE_ADMIN'
          ? validateFinancePermissions(dto.financePermissionCodes)
          : ([] as FinancePermissionCode[]),
    };
  }
  async createInvitation(
    dto: CreateUserInvitationDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const canonical = canonicalizeEmail(dto.email);
    await this.authorizeGrant(
      actorUserId,
      dto.schoolId,
      platformRole,
      dto.roleCode,
    );
    const operationalConfiguration =
      await this.validateOperationalInvitation(dto);
    const schoolResult = await this.db.query<{ id: string; name: string }>(
      `SELECT id, name FROM schools WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [dto.schoolId],
    );
    const school = schoolResult.rows[0];
    if (!school) throw new NotFoundException('School not found.');

    const existingRole = await this.db.query(
      `
      SELECT smr.id FROM users u
      JOIN school_memberships sm ON sm.user_id = u.id AND sm.school_id = $2 AND sm.deleted_at IS NULL
      JOIN school_membership_roles smr ON smr.school_membership_id = sm.id
        AND smr.role::text = $3 AND smr.deleted_at IS NULL
      WHERE u.email_normalized = $1 AND u.deleted_at IS NULL LIMIT 1
    `,
      [canonical.normalized, dto.schoolId, dto.roleCode],
    );
    if (existingRole.rowCount)
      throw new ConflictException(
        'This user already has this role in the school.',
      );

    const { rawToken, tokenHash } = this.tokens.generate();
    const expiresAt = new Date(Date.now() + this.ttlHours() * 3_600_000);
    const invitation = await this.db.withTransaction(async (client) => {
      await client.query(
        `
        UPDATE user_invitations
        SET invitation_status = 'REVOKED', revoked_at = NOW(), updated_at = NOW()
        WHERE school_id = $1
          AND invitation_status = 'PENDING'
          AND (
            (email_normalized = $2 AND role_code = $3)
            OR staff_account_id = $4
          )
      `,
        [
          dto.schoolId,
          canonical.normalized,
          dto.roleCode,
          dto.staffAccountId ?? null,
        ],
      );
      const result = await client.query<{ id: string; expires_at: Date }>(
        `
        INSERT INTO user_invitations (
          school_id, invited_by_user_id, email_original, email_normalized, role_code, locale,
          token_hash, expires_at, first_name, last_name, guardian_id, staff_account_id,
          staff_code, job_title, department, initial_permission_codes, send_count, last_sent_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::text[],1,NOW())
        RETURNING id, expires_at
      `,
        [
          dto.schoolId,
          actorUserId,
          canonical.original,
          canonical.normalized,
          dto.roleCode,
          dto.locale ?? 'fr',
          tokenHash,
          expiresAt,
          dto.firstName?.trim() || null,
          dto.lastName?.trim() || null,
          dto.guardianId ?? null,
          dto.staffAccountId ?? null,
          dto.staffCode?.trim() || null,
          dto.jobTitle?.trim() || null,
          dto.department?.trim() || null,
          operationalConfiguration.financePermissions,
        ],
      );
      await this.activity.recordTx(client, {
        eventType: 'USER_INVITATION_CREATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `User invitation created for ${canonical.normalized}.`,
        payload: {
          invitationId: result.rows[0].id,
          roleCode: dto.roleCode,
          staffAccountId: dto.staffAccountId ?? null,
        },
      });
      return result.rows[0];
    });

    let emailSent = false;
    try {
      await this.email.sendAccountInvitation({
        to: canonical.original,
        schoolName: school.name,
        roleCode: dto.roleCode,
        locale: dto.locale ?? 'fr',
        activationUrl: `${this.publicUrl()}/activate-account#token=${encodeURIComponent(rawToken)}`,
        idempotencyKey: `account-invitation/${invitation.id}/1`,
      });
      emailSent = true;
    } catch {
      await this.db.query(
        `UPDATE user_invitations SET failure_reason = 'EMAIL_DELIVERY_FAILED', updated_at = NOW() WHERE id = $1`,
        [invitation.id],
      );
    }
    return {
      invitationId: invitation.id,
      expiresAt: invitation.expires_at,
      emailSent,
      message: emailSent
        ? 'Invitation created and email sent.'
        : 'Invitation created, but email delivery failed. It can be resent.',
    };
  }

  private async invitationByHash(tokenHash: string, forUpdate?: PoolClient) {
    const executor = forUpdate ?? this.db;
    const result = await executor.query<InvitationRow>(
      `
      SELECT inv.*, s.name AS school_name, u.id AS existing_user_id
      FROM user_invitations inv
      JOIN schools s ON s.id = inv.school_id AND s.deleted_at IS NULL
      LEFT JOIN users u ON u.email_normalized = inv.email_normalized AND u.deleted_at IS NULL
      WHERE inv.token_hash = $1 LIMIT 1 ${forUpdate ? 'FOR UPDATE OF inv' : ''}
    `,
      [tokenHash],
    );
    return result.rows[0];
  }

  private ensurePending(invitation?: InvitationRow) {
    if (
      !invitation ||
      invitation.invitation_status !== 'PENDING' ||
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        'This invitation is invalid or has expired.',
      );
    }
  }

  async inspectInvitation(rawToken: string) {
    const invitation = await this.invitationByHash(this.tokens.hash(rawToken));
    this.ensurePending(invitation);
    const [local = '', domain = ''] = invitation.email_original.split('@');
    const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
    return {
      valid: true,
      invitationId: invitation.id,
      schoolName: invitation.school_name,
      emailMasked: `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`,
      roleCode: invitation.role_code,
      locale: invitation.locale,
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      expiresAt: invitation.expires_at,
      accountAlreadyExists: Boolean(invitation.existing_user_id),
    };
  }

  private async activateMembership(
    client: PoolClient,
    invitation: InvitationRow,
    userId: string,
  ) {
    const membership = await client.query<{ id: string }>(
      `
      INSERT INTO school_memberships (school_id, user_id, membership_status, invited_at, joined_at, activated_at, is_primary)
      VALUES ($1,$2,'ACTIVE',NOW(),NOW(),NOW(),TRUE)
      ON CONFLICT (school_id, user_id) WHERE deleted_at IS NULL
      DO UPDATE SET membership_status='ACTIVE', joined_at=COALESCE(school_memberships.joined_at,NOW()),
        activated_at=NOW(), suspended_at=NULL, updated_at=NOW()
      RETURNING id
    `,
      [invitation.school_id, userId],
    );
    await client.query(
      `
      INSERT INTO school_membership_roles (school_membership_id, role)
      VALUES ($1,$2::school_staff_role)
      ON CONFLICT (school_membership_id, role) WHERE deleted_at IS NULL DO NOTHING
    `,
      [membership.rows[0].id, invitation.role_code],
    );
    await client.query(
      `
      INSERT INTO school_user_roles (school_id,user_id,role,is_primary)
      VALUES ($1,$2,$3::school_role,TRUE)
      ON CONFLICT (school_id,user_id,role)
      DO UPDATE SET
        deleted_at = NULL,
        is_primary = EXCLUDED.is_primary,
        updated_at = NOW()
    `,
      [invitation.school_id, userId, invitation.role_code],
    );
  }

  private async applyOperationalAccessTx(
    client: PoolClient,
    input: {
      invitationId: string;
      schoolId: string;
      userId: string;
      roleCode: SchoolRole;
      invitedByUserId: string;
      guardianId: string | null;
      staffAccountId: string | null;
      staffCode: string | null;
      jobTitle: string | null;
      department: string | null;
      initialPermissionCodes: string[];
    },
  ) {
    if (['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'].includes(input.roleCode)) {
      if (input.staffAccountId) {
        const designated = await client.query<{
          user_id: string | null;
          employment_status: string;
        }>(
          `
          SELECT user_id, employment_status
          FROM school_staff_accounts
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          LIMIT 1
          FOR UPDATE
          `,
          [input.staffAccountId, input.schoolId],
        );
        const staff = designated.rows[0];
        if (!staff) {
          throw new BadRequestException(
            'The designated staff record is no longer available.',
          );
        }
        if (staff.user_id && staff.user_id !== input.userId) {
          throw new ConflictException(
            'The designated staff record is already linked to another account.',
          );
        }
        if (!['ACTIVE', 'ON_LEAVE'].includes(staff.employment_status)) {
          throw new BadRequestException(
            'Only active or on-leave staff can be linked to an account.',
          );
        }
        const duplicate = await client.query(
          `
          SELECT id
          FROM school_staff_accounts
          WHERE school_id = $1
            AND user_id = $2
            AND id <> $3
            AND deleted_at IS NULL
          LIMIT 1
          `,
          [input.schoolId, input.userId, input.staffAccountId],
        );
        if (duplicate.rowCount) {
          throw new ConflictException(
            'This account is already linked to another staff record in the school.',
          );
        }
        await client.query(
          `
          UPDATE school_staff_accounts
          SET
            user_id = $3,
            staff_type = $4,
            updated_at = NOW()
          WHERE id = $1
            AND school_id = $2
            AND deleted_at IS NULL
          `,
          [input.staffAccountId, input.schoolId, input.userId, input.roleCode],
        );
        if (input.roleCode === 'TEACHER') {
          await client.query(
            `
            UPDATE teacher_academic_assignments
            SET
              teacher_user_id = $3,
              updated_at = NOW()
            WHERE school_id = $1
              AND teacher_staff_account_id = $2
            `,
            [input.schoolId, input.staffAccountId, input.userId],
          );
        }
        await client.query(
          `
          INSERT INTO staff_account_user_link_events (
            school_id,
            staff_account_id,
            user_id,
            event_type,
            role_code,
            invitation_id,
            actor_user_id,
            reason
          )
          VALUES ($1, $2, $3, 'LINKED', $4, $5, $6, $7)
          `,
          [
            input.schoolId,
            input.staffAccountId,
            input.userId,
            input.roleCode,
            input.invitationId,
            input.invitedByUserId,
            'Account linked through an accepted staff invitation.',
          ],
        );
      } else {
        await client.query(
          `
          INSERT INTO school_staff_accounts (
            school_id,user_id,staff_code,staff_type,job_title,department,employment_status,created_by_user_id
          ) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7)
          ON CONFLICT (school_id,user_id) WHERE deleted_at IS NULL DO UPDATE SET
            staff_code=COALESCE(EXCLUDED.staff_code,school_staff_accounts.staff_code),
            staff_type=EXCLUDED.staff_type,
            job_title=COALESCE(EXCLUDED.job_title,school_staff_accounts.job_title),
            department=COALESCE(EXCLUDED.department,school_staff_accounts.department),
            employment_status='ACTIVE',updated_at=NOW()
        `,
          [
            input.schoolId,
            input.userId,
            input.staffCode,
            input.roleCode,
            input.jobTitle,
            input.department,
            input.invitedByUserId,
          ],
        );
      }
    }
    if (input.roleCode === 'PARENT') {
      if (!input.guardianId)
        throw new BadRequestException(
          'The parent invitation has no guardian record.',
        );
      const guardian = await client.query<{ id: string }>(
        `
        SELECT id FROM guardians WHERE id=$1 AND school_id=$2 AND deleted_at IS NULL LIMIT 1
      `,
        [input.guardianId, input.schoolId],
      );
      if (!guardian.rows[0])
        throw new BadRequestException(
          'The guardian record is no longer available.',
        );
      await client.query(
        `
        INSERT INTO guardian_account_links (school_id,user_id,guardian_id,created_by_user_id)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (school_id,user_id,guardian_id) WHERE deleted_at IS NULL
        DO UPDATE SET updated_at=NOW()
      `,
        [input.schoolId, input.userId, input.guardianId, input.invitedByUserId],
      );
      await client.query(
        `
        UPDATE guardians SET user_id=COALESCE(user_id,$2),updated_at=NOW()
        WHERE id=$1 AND school_id=$3 AND deleted_at IS NULL
      `,
        [input.guardianId, input.userId, input.schoolId],
      );
    }
    if (input.roleCode === 'FINANCE_ADMIN') {
      const permissions = input.initialPermissionCodes.length
        ? validateFinancePermissions(input.initialPermissionCodes)
        : DEFAULT_FINANCE_PERMISSIONS;
      for (const permission of permissions) {
        await client.query(
          `
          INSERT INTO school_user_permissions (school_id,user_id,permission_code,granted_by_user_id)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (school_id,user_id,permission_code) WHERE deleted_at IS NULL
          DO UPDATE SET granted_by_user_id=EXCLUDED.granted_by_user_id,updated_at=NOW()
        `,
          [input.schoolId, input.userId, permission, input.invitedByUserId],
        );
      }
    }
  }

  private operationalInput(invitation: InvitationRow, userId: string) {
    return {
      invitationId: invitation.id,
      schoolId: invitation.school_id,
      userId,
      roleCode: invitation.role_code,
      invitedByUserId: invitation.invited_by_user_id,
      guardianId: invitation.guardian_id,
      staffAccountId: invitation.staff_account_id,
      staffCode: invitation.staff_code,
      jobTitle: invitation.job_title,
      department: invitation.department,
      initialPermissionCodes: invitation.initial_permission_codes ?? [],
    };
  }
  private consume(client: PoolClient, invitationId: string, userId: string) {
    return client.query(
      `
      UPDATE user_invitations SET invitation_status='ACCEPTED', accepted_at=NOW(),
        accepted_by_user_id=$2, token_hash=encode(digest(gen_random_uuid()::text,'sha256'),'hex'), updated_at=NOW()
      WHERE id=$1
    `,
      [invitationId, userId],
    );
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    if (dto.password !== dto.passwordConfirmation)
      throw new BadRequestException('Password confirmation does not match.');
    return this.db.withTransaction(async (client) => {
      const invitation = await this.invitationByHash(
        this.tokens.hash(dto.token),
        client,
      );
      this.ensurePending(invitation);
      if (invitation.existing_user_id) {
        throw new ConflictException({
          code: 'ACCOUNT_ALREADY_EXISTS',
          message:
            'An account already exists for this email. Sign in to accept the invitation.',
        });
      }
      const firstName = dto.firstName.trim();
      const lastName = dto.lastName.trim();
      if (!firstName || !lastName)
        throw new BadRequestException('First name and last name are required.');
      const password = this.passwords.validate(dto.password, [
        firstName,
        lastName,
        invitation.email_normalized.split('@')[0],
        invitation.school_name,
      ]);
      const passwordHash = await this.passwords.hash(password);
      const user = await client.query<{ id: string }>(
        `
        INSERT INTO users (
          email,email_original,email_normalized,first_name,last_name,password_hash,status,account_status,
          email_verified_at,password_changed_at,failed_login_count,authentication_version
        ) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE','ACTIVE',NOW(),NOW(),0,1) RETURNING id
      `,
        [
          invitation.email_original,
          invitation.email_original,
          invitation.email_normalized,
          firstName,
          lastName,
          passwordHash,
        ],
      );
      const userId = user.rows[0].id;
      await this.activateMembership(client, invitation, userId);
      await this.applyOperationalAccessTx(
        client,
        this.operationalInput(invitation, userId),
      );
      await this.consume(client, invitation.id, userId);
      await this.activity.recordTx(client, {
        eventType: 'USER_INVITATION_ACCEPTED',
        actorType: 'PUBLIC_USER',
        actorUserId: userId,
        schoolId: invitation.school_id,
        summary: 'User account activated through email invitation.',
        payload: {
          invitationId: invitation.id,
          roleCode: invitation.role_code,
        },
      });
      return {
        activated: true,
        userId,
        schoolId: invitation.school_id,
        redirectTo: '/login?activated=1',
      };
    });
  }

  async acceptInvitationForExistingUser(rawToken: string, actorUserId: string) {
    return this.db.withTransaction(async (client) => {
      const invitation = await this.invitationByHash(
        this.tokens.hash(rawToken),
        client,
      );
      this.ensurePending(invitation);
      const actor = await client.query<{ email_normalized: string }>(
        `SELECT email_normalized FROM users WHERE id=$1 AND deleted_at IS NULL`,
        [actorUserId],
      );
      if (actor.rows[0]?.email_normalized !== invitation.email_normalized) {
        throw new ForbiddenException(
          'This invitation belongs to another email address.',
        );
      }
      await this.activateMembership(client, invitation, actorUserId);
      await this.applyOperationalAccessTx(
        client,
        this.operationalInput(invitation, actorUserId),
      );
      await this.consume(client, invitation.id, actorUserId);
      await client.query(
        `UPDATE users SET authentication_version=authentication_version+1,updated_at=NOW() WHERE id=$1`,
        [actorUserId],
      );
      await client.query(
        `
        UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),
          revocation_reason=COALESCE(revocation_reason,'ROLE_CHANGED')
        WHERE user_id=$1 AND revoked_at IS NULL
      `,
        [actorUserId],
      );
      return {
        accepted: true,
        schoolId: invitation.school_id,
        reauthenticationRequired: true,
        redirectTo: '/login?membershipAdded=1',
      };
    });
  }

  async resendInvitation(
    invitationId: string,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const result = await this.db.query<InvitationRow>(
      `
      SELECT inv.*, s.name AS school_name, NULL::uuid AS existing_user_id
      FROM user_invitations inv JOIN schools s ON s.id=inv.school_id AND s.deleted_at IS NULL
      WHERE inv.id=$1 LIMIT 1
    `,
      [invitationId],
    );
    const invitation = result.rows[0];
    if (!invitation) throw new NotFoundException('Invitation not found.');
    await this.authorizeGrant(
      actorUserId,
      invitation.school_id,
      platformRole,
      invitation.role_code,
    );
    if (invitation.invitation_status !== 'PENDING')
      throw new BadRequestException('Only pending invitations can be resent.');
    const { rawToken, tokenHash } = this.tokens.generate();
    const sendCount = invitation.send_count + 1;
    const expiresAt = new Date(Date.now() + this.ttlHours() * 3_600_000);
    await this.db.query(
      `
      UPDATE user_invitations SET token_hash=$2,expires_at=$3,send_count=$4,last_sent_at=NOW(),
        failure_reason=NULL,updated_at=NOW() WHERE id=$1
    `,
      [invitation.id, tokenHash, expiresAt, sendCount],
    );
    try {
      await this.email.sendAccountInvitation({
        to: invitation.email_original,
        schoolName: invitation.school_name,
        roleCode: invitation.role_code,
        locale: invitation.locale,
        activationUrl: `${this.publicUrl()}/activate-account#token=${encodeURIComponent(rawToken)}`,
        idempotencyKey: `account-invitation/${invitation.id}/${sendCount}`,
      });
    } catch (error) {
      await this.db.query(
        `UPDATE user_invitations SET failure_reason='EMAIL_DELIVERY_FAILED',updated_at=NOW() WHERE id=$1`,
        [invitation.id],
      );
      throw error;
    }
    return { resent: true, expiresAt };
  }

  async revokeInvitation(
    invitationId: string,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const result = await this.db.query<{
      school_id: string;
      role_code: SchoolRole;
      invitation_status: string;
    }>(
      `SELECT school_id,role_code,invitation_status FROM user_invitations WHERE id=$1`,
      [invitationId],
    );
    const invitation = result.rows[0];
    if (!invitation) throw new NotFoundException('Invitation not found.');
    await this.authorizeGrant(
      actorUserId,
      invitation.school_id,
      platformRole,
      invitation.role_code,
    );
    if (invitation.invitation_status !== 'PENDING')
      throw new BadRequestException('Only pending invitations can be revoked.');
    await this.db.query(
      `
      UPDATE user_invitations SET invitation_status='REVOKED',revoked_at=NOW(),
        token_hash=encode(digest(gen_random_uuid()::text,'sha256'),'hex'),updated_at=NOW() WHERE id=$1
    `,
      [invitationId],
    );
    return { revoked: true };
  }

  async listSchoolUsers(
    schoolId: string,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const roles = await this.actorRoles(actorUserId, schoolId, platformRole);
    if (!roles.includes('SUPER_ADMIN') && !roles.includes('SCHOOL_ADMIN')) {
      throw new ForbiddenException('You cannot manage users for this school.');
    }
    const [memberships, invitations] = await Promise.all([
      this.db.query<{
        membership_id: string;
        user_id: string;
        first_name: string | null;
        last_name: string | null;
        email_original: string;
        account_status: string;
        email_verified_at: Date | null;
        last_login_at: Date | null;
        role_code: SchoolRole;
        membership_status: 'ACTIVE' | 'SUSPENDED';
        granted_at: Date;
      }>(
        `
        SELECT sm.id AS membership_id,u.id AS user_id,u.first_name,u.last_name,u.email_original,
          u.account_status,u.email_verified_at,u.last_login_at,smr.role AS role_code,
          sm.membership_status,smr.created_at AS granted_at
        FROM school_memberships sm JOIN users u ON u.id=sm.user_id AND u.deleted_at IS NULL
        JOIN school_membership_roles smr ON smr.school_membership_id=sm.id AND smr.deleted_at IS NULL
        WHERE sm.school_id=$1 AND sm.membership_status IN ('ACTIVE','SUSPENDED') AND sm.deleted_at IS NULL
        ORDER BY u.last_name,u.first_name,smr.role
      `,
        [schoolId],
      ),
      this.db.query<{
        id: string;
        email_original: string;
        role_code: SchoolRole;
        locale: 'fr' | 'en';
        invitation_status: string;
        expires_at: Date;
        send_count: number;
        last_sent_at: Date | null;
        failure_reason: string | null;
        created_at: Date;
      }>(
        `
        SELECT id,email_original,role_code,locale,invitation_status,expires_at,send_count,last_sent_at,
          failure_reason,created_at FROM user_invitations WHERE school_id=$1 ORDER BY created_at DESC LIMIT 100
      `,
        [schoolId],
      ),
    ]);
    const users = new Map<
      string,
      {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        accountStatus: string;
        emailVerifiedAt: Date | null;
        lastLoginAt: Date | null;
        memberships: Array<{
          membershipId: string;
          roleCode: SchoolRole;
          membershipStatus: 'ACTIVE' | 'SUSPENDED';
          grantedAt: Date;
        }>;
      }
    >();
    for (const row of memberships.rows) {
      if (!users.has(row.user_id)) {
        users.set(row.user_id, {
          id: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email_original,
          accountStatus: row.account_status,
          emailVerifiedAt: row.email_verified_at,
          lastLoginAt: row.last_login_at,
          memberships: [],
        });
      }
      users.get(row.user_id)!.memberships.push({
        membershipId: row.membership_id,
        roleCode: row.role_code,
        membershipStatus: row.membership_status,
        grantedAt: row.granted_at,
      });
    }
    return {
      users: Array.from(users.values()),
      invitations: invitations.rows.map((row) => ({
        id: row.id,
        email: row.email_original,
        roleCode: row.role_code,
        locale: row.locale,
        status:
          row.invitation_status === 'PENDING' &&
          row.expires_at.getTime() <= Date.now()
            ? 'EXPIRED'
            : row.invitation_status,
        expiresAt: row.expires_at,
        sendCount: row.send_count,
        lastSentAt: row.last_sent_at,
        deliveryFailed: row.failure_reason === 'EMAIL_DELIVERY_FAILED',
        createdAt: row.created_at,
      })),
    };
  }

  async updateSchoolMembershipStatus(
    membershipId: string,
    dto: UpdateSchoolMembershipStatusDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const actorRoles = await this.actorRoles(
      actorUserId,
      dto.schoolId,
      platformRole,
    );
    if (
      !actorRoles.includes('SUPER_ADMIN') &&
      !actorRoles.includes('SCHOOL_ADMIN')
    ) {
      throw new ForbiddenException('You cannot manage users for this school.');
    }
    const result = await this.db.query<{
      id: string;
      user_id: string;
      membership_status: 'ACTIVE' | 'SUSPENDED';
      is_school_admin: boolean;
    }>(
      `
      SELECT sm.id,sm.user_id,sm.membership_status,
        EXISTS (
          SELECT 1 FROM school_membership_roles smr
          WHERE smr.school_membership_id=sm.id AND smr.role='SCHOOL_ADMIN' AND smr.deleted_at IS NULL
        ) AS is_school_admin
      FROM school_memberships sm
      WHERE sm.id=$1 AND sm.school_id=$2 AND sm.deleted_at IS NULL LIMIT 1
    `,
      [membershipId, dto.schoolId],
    );
    const membership = result.rows[0];
    if (!membership)
      throw new NotFoundException('School membership not found.');
    if (membership.user_id === actorUserId) {
      throw new BadRequestException(
        'You cannot change your own active membership.',
      );
    }
    if (membership.is_school_admin && dto.membershipStatus === 'SUSPENDED') {
      const activeAdmins = await this.db.query<{ count: string }>(
        `
        SELECT COUNT(DISTINCT sm.id)::text AS count
        FROM school_memberships sm
        JOIN school_membership_roles smr ON smr.school_membership_id=sm.id
        WHERE sm.school_id=$1 AND sm.membership_status='ACTIVE' AND sm.deleted_at IS NULL
          AND smr.role='SCHOOL_ADMIN' AND smr.deleted_at IS NULL
      `,
        [dto.schoolId],
      );
      if (Number(activeAdmins.rows[0]?.count ?? 0) <= 1) {
        throw new BadRequestException(
          'The last active school administrator cannot be suspended.',
        );
      }
    }
    await this.db.withTransaction(async (client) => {
      await client.query(
        `
        UPDATE school_memberships SET membership_status=$3::school_membership_status,
          suspended_at=CASE WHEN $3::school_membership_status='SUSPENDED' THEN NOW() ELSE NULL END,
          activated_at=CASE WHEN $3::school_membership_status='ACTIVE' THEN COALESCE(activated_at,NOW()) ELSE activated_at END,
          updated_at=NOW()
        WHERE id=$1 AND school_id=$2
      `,
        [membershipId, dto.schoolId, dto.membershipStatus],
      );
      await client.query(
        `
        UPDATE users SET authentication_version=authentication_version+1,updated_at=NOW() WHERE id=$1
      `,
        [membership.user_id],
      );
      await client.query(
        `
        UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),
          revocation_reason=COALESCE(revocation_reason,'MEMBERSHIP_STATUS_CHANGED')
        WHERE user_id=$1 AND revoked_at IS NULL
      `,
        [membership.user_id],
      );
      await this.activity.recordTx(client, {
        eventType: 'SCHOOL_MEMBERSHIP_STATUS_CHANGED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `School membership changed to ${dto.membershipStatus}.`,
        payload: {
          membershipId,
          affectedUserId: membership.user_id,
          previousStatus: membership.membership_status,
          newStatus: dto.membershipStatus,
        },
      });
    });
    return {
      updated: true,
      membershipId,
      membershipStatus: dto.membershipStatus,
      sessionsRevoked: true,
    };
  }
}
