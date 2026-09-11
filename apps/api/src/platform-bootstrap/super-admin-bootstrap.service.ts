import { BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { canonicalizeEmail } from '../auth/security/email-identity';
import { PasswordService } from '../auth/security/password.service';

export const SUPER_ADMIN_BOOTSTRAP_CONFIRMATION =
  'CREATE_INITIAL_SUPER_ADMIN';

const LEGACY_SUPER_ADMIN_ID = '94444444-4444-4444-8444-444444444444';
const LEGACY_SUPER_ADMIN_EMAIL = 'superadmin@almac.local';
const DISABLED_LEGACY_PASSWORD_HASH = 'DISABLED_LEGACY_SEED';
const BOOTSTRAP_ADVISORY_LOCK = '61460620260908';

export type BootstrapSuperAdminInput = {
  confirmation: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export class SuperAdminBootstrapService {
  constructor(
    private readonly pool: Pool,
    private readonly passwords: PasswordService,
  ) {}

  async bootstrap(input: BootstrapSuperAdminInput) {
    if (input.confirmation !== SUPER_ADMIN_BOOTSTRAP_CONFIRMATION) {
      throw new BadRequestException(
        `Confirmation must be exactly ${SUPER_ADMIN_BOOTSTRAP_CONFIRMATION}.`,
      );
    }

    const firstName = input.firstName.trim().normalize('NFC');
    const lastName = input.lastName.trim().normalize('NFC');
    if (!firstName || !lastName) {
      throw new BadRequestException('First name and last name are required.');
    }

    const email = canonicalizeEmail(input.email);
    const password = this.passwords.validate(input.password, [
      firstName,
      lastName,
      email.normalized.split('@')[0],
    ]);
    const passwordHash = await this.passwords.hash(password);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
        BOOTSTRAP_ADVISORY_LOCK,
      ]);

      const existingAdmin = await client.query<{ id: string }>(
        `
        SELECT id
        FROM users
        WHERE platform_role = 'SUPER_ADMIN'
          AND NOT (
            id = $1
            AND email_normalized = $2
            AND account_status = 'SUSPENDED'
            AND password_hash = $3
          )
        LIMIT 1
        `,
        [
          LEGACY_SUPER_ADMIN_ID,
          LEGACY_SUPER_ADMIN_EMAIL,
          DISABLED_LEGACY_PASSWORD_HASH,
        ],
      );
      if (existingAdmin.rowCount) {
        throw new BadRequestException(
          'A Super Admin already exists. Use the normal account-recovery process.',
        );
      }

      const existingEmail = await client.query<{ id: string }>(
        `
        SELECT id
        FROM users
        WHERE email_normalized = $1
           OR LOWER(BTRIM(email)) = $1
        LIMIT 1
        `,
        [email.normalized],
      );
      if (existingEmail.rowCount) {
        throw new BadRequestException(
          'That email address already belongs to an account.',
        );
      }

      const created = await client.query<{
        id: string;
        created_at: Date;
      }>(
        `
        INSERT INTO users (
          email,
          email_original,
          email_normalized,
          password_hash,
          preferred_locale,
          status,
          account_status,
          email_verified_at,
          password_changed_at,
          failed_login_count,
          locked_until,
          authentication_version,
          mfa_required,
          platform_role,
          first_name,
          last_name
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'fr',
          'ACTIVE',
          'ACTIVE',
          NOW(),
          NOW(),
          0,
          NULL,
          1,
          FALSE,
          'SUPER_ADMIN',
          $5,
          $6
        )
        RETURNING id, created_at
        `,
        [
          email.original,
          email.original,
          email.normalized,
          passwordHash,
          firstName,
          lastName,
        ],
      );
      const user = created.rows[0];

      await client.query(
        `
        INSERT INTO authentication_events (
          user_id,
          event_type,
          email_normalized,
          success,
          metadata
        )
        VALUES ($1, 'SUPER_ADMIN_BOOTSTRAPPED', $2, TRUE, $3::jsonb)
        `,
        [user.id, email.normalized, JSON.stringify({ source: 'cli' })],
      );
      await client.query(
        `
        INSERT INTO platform_activity_logs (
          event_type,
          actor_type,
          actor_user_id,
          summary,
          payload
        )
        VALUES (
          'SUPER_ADMIN_BOOTSTRAPPED',
          'SYSTEM',
          NULL,
          'Initial Super Admin account created.',
          $1::jsonb
        )
        `,
        [JSON.stringify({ userId: user.id })],
      );

      await client.query('COMMIT');
      return {
        userId: user.id,
        email: email.original,
        createdAt: user.created_at.toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
