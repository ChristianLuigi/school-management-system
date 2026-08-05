import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { canonicalizeEmail } from '../auth/security/email-identity';
import { PasswordService } from '../auth/security/password.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { CreatePlatformStaffDto } from './dto/create-platform-staff.dto';
import { ListPlatformStaffDto } from './dto/list-platform-staff.dto';

type StaffRole = 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';

type StaffListRow = {
  membership_id: string;
  school_id: string;
  school_name: string;
  school_code: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  membership_status: 'ACTIVE' | 'SUSPENDED' | 'INVITED' | 'REMOVED';
  job_title: string | null;
  roles: StaffRole[] | null;
  created_at: string;
  updated_at: string;
};

type SchoolRow = {
  id: string;
  name: string;
  code: string;
};

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

type MembershipRow = {
  id: string;
  school_id: string;
  user_id: string;
  membership_status: 'ACTIVE' | 'SUSPENDED' | 'INVITED' | 'REMOVED';
};

type MembershipLookupRow = {
  id: string;
  user_id: string;
  school_id: string;
  email: string;
};

@Injectable()
export class PlatformStaffService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
    private readonly passwords: PasswordService,
  ) {}

  async list(query: ListPlatformStaffDto) {
    const values: unknown[] = [];
    const where: string[] = [
      'sm.deleted_at IS NULL',
      'u.deleted_at IS NULL',
      's.deleted_at IS NULL',
    ];

    if (query.schoolId) {
      values.push(query.schoolId);
      where.push(`sm.school_id = $${values.length}`);
    }

    if (query.status) {
      values.push(query.status);
      where.push(`sm.membership_status = $${values.length}`);
    }

    if (query.role) {
      values.push(query.role);
      where.push(
        `EXISTS (
          SELECT 1
          FROM school_membership_roles smr_filter
          WHERE smr_filter.school_membership_id = sm.id
            AND smr_filter.role = $${values.length}
            AND smr_filter.deleted_at IS NULL
        )`,
      );
    }

    if (query.search?.trim()) {
      values.push(`%${query.search.trim().toLowerCase()}%`);
      where.push(
        `(LOWER(u.email) LIKE $${values.length} OR LOWER(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) LIKE $${values.length})`,
      );
    }

    const result = await this.db.query<StaffListRow>(
      `
      SELECT
        sm.id AS membership_id,
        sm.school_id,
        s.name AS school_name,
        s.code AS school_code,
        sm.user_id,
        u.email,
        u.first_name,
        u.last_name,
        sm.membership_status,
        sm.job_title,
        COALESCE(
          ARRAY_AGG(smr.role ORDER BY smr.role) FILTER (WHERE smr.deleted_at IS NULL),
          ARRAY[]::school_staff_role[]
        ) AS roles,
        sm.created_at,
        sm.updated_at
      FROM school_memberships sm
      JOIN users u ON u.id = sm.user_id
      JOIN schools s ON s.id = sm.school_id
      LEFT JOIN school_membership_roles smr
        ON smr.school_membership_id = sm.id
      WHERE ${where.join(' AND ')}
      GROUP BY
        sm.id,
        sm.school_id,
        s.name,
        s.code,
        sm.user_id,
        u.email,
        u.first_name,
        u.last_name,
        sm.membership_status,
        sm.job_title,
        sm.created_at,
        sm.updated_at
      ORDER BY
        s.name ASC,
        u.last_name ASC NULLS LAST,
        u.first_name ASC NULLS LAST,
        u.email ASC
      `,
      values,
    );

    return result.rows.map((row) => ({
      ...row,
      roles: row.roles ?? [],
    }));
  }

  async create(dto: CreatePlatformStaffDto) {
    return this.db.withTransaction(async (client) => {
      const school = await this.findSchool(client, dto.schoolId);
      const email = canonicalizeEmail(dto.email);
      const firstName = dto.firstName.trim();
      const lastName = dto.lastName.trim();
      const jobTitle = dto.jobTitle?.trim() || null;
      const generatedPassword = this.generateTemporaryPassword();
      const temporaryPassword = this.passwords.validate(generatedPassword, [
        firstName,
        lastName,
        email.normalized.split('@')[0],
        school.name,
      ]);
      const passwordHash = await this.passwords.hash(temporaryPassword);

      const user = await this.findOrCreateUser(client, {
        emailOriginal: email.original,
        emailNormalized: email.normalized,
        firstName,
        lastName,
        passwordHash,
      });

      const membership = await this.findOrCreateMembership(client, {
        schoolId: dto.schoolId,
        userId: user.id,
        jobTitle,
      });

      await this.ensureMembershipRole(client, membership.id, dto.role);
      await this.ensureLegacySchoolUserRole(
        client,
        dto.schoolId,
        user.id,
        dto.role,
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'STAFF_CREATED',
        actorType: 'SUPERADMIN',
        schoolId: dto.schoolId,
        membershipId: membership.id,
        summary: `Staff account ${email.normalized} was created as ${dto.role}.`,
        payload: {
          role: dto.role,
          email: email.normalized,
        },
      });

      return {
        school,
        user,
        membershipId: membership.id,
        role: dto.role,
        temporaryPassword,
      };
    });
  }

  async suspend(membershipId: string) {
    const result = await this.db.query<MembershipRow>(
      `
      UPDATE school_memberships
      SET
        membership_status = 'SUSPENDED',
        suspended_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, school_id, user_id, membership_status
      `,
      [membershipId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`Membership ${membershipId} not found.`);
    }

    await this.platformActivityService.record({
      eventType: 'STAFF_SUSPENDED',
      actorType: 'SUPERADMIN',
      schoolId: result.rows[0].school_id,
      membershipId,
      summary: 'Staff membership was suspended.',
      payload: {},
    });

    return result.rows[0];
  }

  async reactivate(membershipId: string) {
    const result = await this.db.query<MembershipRow>(
      `
      UPDATE school_memberships
      SET
        membership_status = 'ACTIVE',
        activated_at = NOW(),
        suspended_at = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, school_id, user_id, membership_status
      `,
      [membershipId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`Membership ${membershipId} not found.`);
    }

    await this.platformActivityService.record({
      eventType: 'STAFF_REACTIVATED',
      actorType: 'SUPERADMIN',
      schoolId: result.rows[0].school_id,
      membershipId,
      summary: 'Staff membership was reactivated.',
      payload: {},
    });

    return result.rows[0];
  }

  async resetTemporaryPassword(membershipId: string) {
    return this.db.withTransaction(async (client) => {
      const membership = await this.findMembershipLookup(client, membershipId);
      const email = canonicalizeEmail(membership.email);
      const generatedPassword = this.generateTemporaryPassword();
      const temporaryPassword = this.passwords.validate(generatedPassword, [
        email.normalized.split('@')[0],
      ]);
      const passwordHash = await this.passwords.hash(temporaryPassword);

      await client.query(
        `
        UPDATE users
        SET
          email_original = $3,
          email_normalized = $4,
          password_hash = $2,
          status = 'ACTIVE',
          account_status = 'ACTIVE',
          email_verified_at = COALESCE(
            email_verified_at,
            NOW()
          ),
          password_changed_at = NOW(),
          failed_login_count = 0,
          locked_until = NULL,
          authentication_version =
            authentication_version + 1,
          updated_at = NOW()
        WHERE id = $1
        `,
        [
          membership.user_id,
          passwordHash,
          email.original,
          email.normalized,
        ],
      );

      await client.query(
        `
        UPDATE auth_sessions
        SET
          revoked_at = COALESCE(revoked_at, NOW()),
          revocation_reason = COALESCE(
            revocation_reason,
            'PLATFORM_PASSWORD_RESET'
          ),
          updated_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
        `,
        [membership.user_id],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'STAFF_PASSWORD_RESET',
        actorType: 'SUPERADMIN',
        schoolId: membership.school_id,
        membershipId,
        summary: `Temporary password was reset for ${membership.email}.`,
        payload: {
          email: membership.email,
        },
      });

      return {
        membershipId,
        email: membership.email,
        temporaryPassword,
      };
    });
  }

  private async findSchool(
    client: PoolClient,
    schoolId: string,
  ): Promise<SchoolRow> {
    const result = await client.query<SchoolRow>(
      `
      SELECT id, name, code
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );

    const school = result.rows[0];

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found.`);
    }

    return school;
  }

  private async findOrCreateUser(
    client: PoolClient,
    input: {
      emailOriginal: string;
      emailNormalized: string;
      firstName: string;
      lastName: string;
      passwordHash: string;
    },
  ): Promise<UserRow> {
    const existing = await client.query<UserRow>(
      `
      SELECT id, email, first_name, last_name
      FROM users
      WHERE (
          email_normalized = $1
          OR LOWER(BTRIM(email::TEXT)) = $1
        )
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [input.emailNormalized],
    );

    if (existing.rows[0]) {
      const updated = await client.query<UserRow>(
        `
        UPDATE users
        SET
          email_original = $2,
          email_normalized = $3,
          first_name = COALESCE(first_name, $4),
          last_name = COALESCE(last_name, $5),
          password_hash = $6,
          status = 'ACTIVE',
          account_status = 'ACTIVE',
          email_verified_at = COALESCE(
            email_verified_at,
            NOW()
          ),
          password_changed_at = NOW(),
          failed_login_count = 0,
          locked_until = NULL,
          authentication_version =
            authentication_version + 1,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, first_name, last_name
        `,
        [
          existing.rows[0].id,
          input.emailOriginal,
          input.emailNormalized,
          input.firstName,
          input.lastName,
          input.passwordHash,
        ],
      );

      await client.query(
        `
        UPDATE auth_sessions
        SET
          revoked_at = COALESCE(revoked_at, NOW()),
          revocation_reason = COALESCE(
            revocation_reason,
            'PLATFORM_CREDENTIAL_REPROVISIONED'
          ),
          updated_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
        `,
        [existing.rows[0].id],
      );

      return updated.rows[0];
    }

    const inserted = await client.query<UserRow>(
      `
      INSERT INTO users (
        email,
        email_original,
        email_normalized,
        password_hash,
        preferred_locale,
        first_name,
        last_name,
        status,
        account_status,
        email_verified_at,
        password_changed_at,
        failed_login_count,
        locked_until
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'fr',
        $5,
        $6,
        'ACTIVE',
        'ACTIVE',
        NOW(),
        NOW(),
        0,
        NULL
      )
      RETURNING id, email, first_name, last_name
      `,
      [
        input.emailOriginal,
        input.emailOriginal,
        input.emailNormalized,
        input.passwordHash,
        input.firstName,
        input.lastName,
      ],
    );

    return inserted.rows[0];
  }
  private async findOrCreateMembership(
    client: PoolClient,
    input: {
      schoolId: string;
      userId: string;
      jobTitle: string | null;
    },
  ): Promise<MembershipRow> {
    const existing = await client.query<MembershipRow>(
      `
      SELECT id, school_id, user_id, membership_status
      FROM school_memberships
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [input.schoolId, input.userId],
    );

    if (existing.rows[0]) {
      const updated = await client.query<MembershipRow>(
        `
        UPDATE school_memberships
        SET
          membership_status = 'ACTIVE',
          job_title = COALESCE($2, job_title),
          joined_at = COALESCE(joined_at, NOW()),
          activated_at = NOW(),
          suspended_at = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, school_id, user_id, membership_status
        `,
        [existing.rows[0].id, input.jobTitle],
      );

      return updated.rows[0];
    }

    const inserted = await client.query<MembershipRow>(
      `
      INSERT INTO school_memberships (
        school_id,
        user_id,
        membership_status,
        job_title,
        invited_at,
        activated_at,
        joined_at,
        is_primary
      )
      VALUES ($1, $2, 'ACTIVE', $3, NOW(), NOW(), NOW(), TRUE)
      RETURNING id, school_id, user_id, membership_status
      `,
      [input.schoolId, input.userId, input.jobTitle],
    );

    return inserted.rows[0];
  }

  private async ensureMembershipRole(
    client: PoolClient,
    membershipId: string,
    role: StaffRole,
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
      [membershipId, role],
    );
  }

  private async ensureLegacySchoolUserRole(
    client: PoolClient,
    schoolId: string,
    userId: string,
    role: StaffRole,
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

  private async findMembershipLookup(
    client: PoolClient,
    membershipId: string,
  ): Promise<MembershipLookupRow> {
    const result = await client.query<MembershipLookupRow>(
      `
      SELECT
        sm.id,
        sm.user_id,
        sm.school_id,
        u.email
      FROM school_memberships sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.id = $1
        AND sm.deleted_at IS NULL
        AND u.deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [membershipId],
    );

    const membership = result.rows[0];

    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found.`);
    }

    return membership;
  }

  private generateTemporaryPassword() {
    return `Tmp-${randomBytes(4).toString('hex')}-A1`;
  }
}
