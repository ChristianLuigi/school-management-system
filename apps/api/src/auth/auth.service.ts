import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { EmailService } from '../email/email.service';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { AuthTokenService } from './security/auth-token.service';
import { canonicalizeEmail } from './security/email-identity';
import { PasswordService } from './security/password.service';
import { SessionTokenService } from './security/session-token.service';

type UserRow = {
  id: string; first_name: string | null; last_name: string | null;
  email_original: string; email_normalized: string; password_hash: string | null;
  account_status: string; email_verified_at: Date | null; failed_login_count: number;
  locked_until: Date | null; authentication_version: number; platform_role: 'SUPER_ADMIN' | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly passwords: PasswordService,
    private readonly authTokens: AuthTokenService,
    private readonly tokens: SessionTokenService,
    private readonly email: EmailService,
  ) {}

  private numberSetting(name: string, fallback: number, minimum = 1) {
    const value = Number(process.env[name] ?? fallback);
    return Number.isFinite(value) && value >= minimum ? value : fallback;
  }
  private absoluteHours() { return this.numberSetting('AUTH_SESSION_ABSOLUTE_HOURS', 12); }
  private idleMinutes() { return this.numberSetting('AUTH_SESSION_IDLE_MINUTES', 30); }
  private maxFailures() { return this.numberSetting('AUTH_MAX_FAILED_LOGINS', 5, 3); }
  private lockMinutes() { return this.numberSetting('AUTH_ACCOUNT_LOCK_MINUTES', 15); }
  private passwordResetTtlMinutes() {
    return this.numberSetting('AUTH_PASSWORD_RESET_TTL_MINUTES', 30);
  }
  private publicUrl() {
    const value = process.env.APP_PUBLIC_URL?.replace(/\/+$/, '');
    if (!value) throw new Error('APP_PUBLIC_URL is not configured.');
    return value;
  }
  private genericPasswordResetResponse() {
    return {
      accepted: true,
      message: 'If an eligible account exists for this email, password-reset instructions will be sent.',
    };
  }
  private maskEmail(value: string) {
    const [local = '', domain = ''] = value.split('@');
    const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
  }
  private failure() {
    return new UnauthorizedException({
      code: 'AUTHENTICATION_FAILED',
      message: 'Email or password is incorrect.',
    });
  }

  private async failed(user: UserRow) {
    const now = Date.now();
    if (user.locked_until && user.locked_until.getTime() > now) {
      await this.db.query(
        `INSERT INTO authentication_events(user_id,event_type,email_normalized,success)
         VALUES($1,'LOGIN_FAILED',$2,FALSE)`,
        [user.id, user.email_normalized],
      );
      return;
    }
    const next = user.locked_until && user.locked_until.getTime() <= now ? 1 : user.failed_login_count + 1;
    const shouldLock = next >= this.maxFailures();
    await this.db.withTransaction(async (client) => {
      await client.query(`
        UPDATE users SET failed_login_count=$2,
          locked_until=CASE WHEN $3::boolean THEN NOW()+($4*INTERVAL '1 minute') ELSE NULL END,
          account_status=CASE WHEN $3::boolean THEN 'LOCKED'::user_account_status ELSE account_status END,
          updated_at=NOW() WHERE id=$1
      `, [user.id, shouldLock ? 0 : next, shouldLock, this.lockMinutes()]);
      await client.query(`
        INSERT INTO authentication_events(user_id,event_type,email_normalized,success,metadata)
        VALUES($1,$2,$3,FALSE,jsonb_build_object('failedAttemptNumber',$4::integer))
      `, [user.id, shouldLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', user.email_normalized, next]);
    });
  }

  async login(dto: LoginDto) {
    const email = canonicalizeEmail(dto.email);
    const result = await this.db.query<UserRow>(`
      SELECT id,first_name,last_name,email_original,email_normalized,password_hash,account_status,
        email_verified_at,failed_login_count,locked_until,authentication_version,platform_role
      FROM users WHERE email_normalized=$1 AND deleted_at IS NULL LIMIT 1
    `, [email.normalized]);
    const user = result.rows[0];
    const passwordValid = await this.passwords.verifyOrDummy(user?.password_hash, dto.password);

    if (!user) {
      await this.db.query(
        `INSERT INTO authentication_events(event_type,email_normalized,success)
         VALUES('LOGIN_FAILED',$1,FALSE)`,
        [email.normalized],
      );
      throw this.failure();
    }

    const lockExpired = Boolean(user.locked_until && user.locked_until.getTime() <= Date.now());
    if (lockExpired && user.account_status === 'LOCKED') {
      await this.db.query(
        `UPDATE users SET account_status='ACTIVE',locked_until=NULL,failed_login_count=0,updated_at=NOW() WHERE id=$1`,
        [user.id],
      );
      user.account_status = 'ACTIVE';
      user.locked_until = null;
      user.failed_login_count = 0;
    }
    const locked = Boolean(user.locked_until && user.locked_until.getTime() > Date.now());
    const canLogin = user.account_status === 'ACTIVE' && Boolean(user.email_verified_at) &&
      Boolean(user.password_hash) && !locked;
    if (!passwordValid || !canLogin) {
      await this.failed(user);
      throw this.failure();
    }

    const now = Date.now();
    const expiresAt = new Date(now + this.absoluteHours() * 3_600_000);
    const idleExpiresAt = new Date(Math.min(expiresAt.getTime(), now + this.idleMinutes() * 60_000));
    const { rawToken, tokenHash } = this.tokens.generate();
    const session = await this.db.withTransaction(async (client) => {
      await client.query(`
        UPDATE users SET failed_login_count=0,locked_until=NULL,last_login_at=NOW(),updated_at=NOW() WHERE id=$1
      `, [user.id]);
      const created = await client.query<{ id: string }>(`
        INSERT INTO auth_sessions(user_id,token_hash,authentication_version,idle_expires_at,expires_at)
        VALUES($1,$2,$3,$4,$5) RETURNING id
      `, [user.id, tokenHash, user.authentication_version, idleExpiresAt, expiresAt]);
      await client.query(`
        INSERT INTO authentication_events(user_id,event_type,email_normalized,success,metadata)
        VALUES($1,'LOGIN_SUCCEEDED',$2,TRUE,jsonb_build_object('sessionId',$3::text))
      `, [user.id, user.email_normalized, created.rows[0].id]);
      return created.rows[0];
    });

    if (user.password_hash && this.passwords.needsRehash(user.password_hash)) {
      const replacement = await this.passwords.hash(dto.password.normalize('NFC'));
      await this.db.query(
        `UPDATE users SET password_hash=$2,password_changed_at=NOW(),updated_at=NOW() WHERE id=$1`,
        [user.id, replacement],
      );
    }
    return {
      sessionToken: rawToken,
      session: { id: session.id, expiresAt: expiresAt.toISOString(), idleExpiresAt: idleExpiresAt.toISOString() },
      user: {
        id: user.id, firstName: user.first_name, lastName: user.last_name,
        email: user.email_original, platformRole: user.platform_role,
      },
    };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = canonicalizeEmail(dto.email);
    const result = await this.db.query<{
      id: string; first_name: string | null; email_original: string;
      email_normalized: string; account_status: string; email_verified_at: Date | null;
    }>(`
      SELECT id,first_name,email_original,email_normalized,account_status,email_verified_at
      FROM users WHERE email_normalized=$1 AND deleted_at IS NULL LIMIT 1
    `, [email.normalized]);
    const user = result.rows[0];
    const eligible = user && user.account_status === 'ACTIVE' && Boolean(user.email_verified_at);

    if (!eligible) {
      await this.db.query(`
        INSERT INTO authentication_events(event_type,email_normalized,success)
        VALUES('PASSWORD_RESET_REQUESTED',$1,TRUE)
      `, [email.normalized]);
      return this.genericPasswordResetResponse();
    }

    const { rawToken, tokenHash } = this.authTokens.generate();
    const expiresAt = new Date(Date.now() + this.passwordResetTtlMinutes() * 60_000);
    const resetRequest = await this.db.withTransaction(async (client) => {
      await client.query(`
        UPDATE password_reset_requests SET reset_status='REVOKED',revoked_at=NOW(),updated_at=NOW()
        WHERE user_id=$1 AND reset_status='PENDING'
      `, [user.id]);
      const created = await client.query<{ id: string }>(`
        INSERT INTO password_reset_requests(
          user_id,token_hash,reset_status,expires_at,email_send_count,last_email_sent_at,email_delivery_status
        ) VALUES($1,$2,'PENDING',$3,1,NOW(),'PENDING') RETURNING id
      `, [user.id, tokenHash, expiresAt]);
      await client.query(`
        INSERT INTO authentication_events(user_id,event_type,email_normalized,success,metadata)
        VALUES($1,'PASSWORD_RESET_REQUESTED',$2,TRUE,jsonb_build_object('resetRequestId',$3::text))
      `, [user.id, user.email_normalized, created.rows[0].id]);
      return created.rows[0];
    });

    const resetUrl = `${this.publicUrl()}/reset-password#token=${encodeURIComponent(rawToken)}`;
    try {
      await this.email.sendPasswordReset({
        to: user.email_original,
        firstName: user.first_name,
        resetUrl,
        locale: dto.locale ?? 'fr',
        idempotencyKey: `password-reset/${resetRequest.id}/1`,
      });
      await this.db.query(`
        UPDATE password_reset_requests SET email_delivery_status='SENT',email_delivery_error=NULL,updated_at=NOW()
        WHERE id=$1
      `, [resetRequest.id]);
    } catch {
      await this.db.query(`
        UPDATE password_reset_requests SET email_delivery_status='FAILED',email_delivery_error='DELIVERY_FAILED',updated_at=NOW()
        WHERE id=$1
      `, [resetRequest.id]);
    }
    return this.genericPasswordResetResponse();
  }

  async inspectPasswordReset(rawToken: string) {
    const result = await this.db.query<{
      id: string; reset_status: string; expires_at: Date; email_original: string;
    }>(`
      SELECT reset.id,reset.reset_status,reset.expires_at,usr.email_original
      FROM password_reset_requests reset
      JOIN users usr ON usr.id=reset.user_id AND usr.deleted_at IS NULL
      WHERE reset.token_hash=$1 LIMIT 1
    `, [this.authTokens.hash(rawToken)]);
    const reset = result.rows[0];
    if (!reset || reset.reset_status !== 'PENDING' || reset.expires_at.getTime() <= Date.now()) {
      throw new BadRequestException('This password-reset link is invalid or has expired.');
    }
    return { valid: true, emailMasked: this.maskEmail(reset.email_original), expiresAt: reset.expires_at };
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException('Password confirmation does not match.');
    }
    const tokenHash = this.authTokens.hash(dto.token);
    const result = await this.db.withTransaction(async (client) => {
      const resetResult = await client.query<{
        reset_id: string; reset_status: string; expires_at: Date; user_id: string;
        email_original: string; email_normalized: string; first_name: string | null;
        last_name: string | null; password_hash: string | null; school_names: string | null;
      }>(`
        SELECT reset.id reset_id,reset.reset_status,reset.expires_at,usr.id user_id,
          usr.email_original,usr.email_normalized,usr.first_name,usr.last_name,usr.password_hash,
          (SELECT STRING_AGG(DISTINCT school.name,' ') FROM school_memberships membership
            JOIN schools school ON school.id=membership.school_id AND school.deleted_at IS NULL
            WHERE membership.user_id=usr.id AND membership.membership_status='ACTIVE'
              AND membership.deleted_at IS NULL) school_names
        FROM password_reset_requests reset
        JOIN users usr ON usr.id=reset.user_id AND usr.deleted_at IS NULL
        WHERE reset.token_hash=$1 FOR UPDATE OF reset,usr
      `, [tokenHash]);
      const reset = resetResult.rows[0];
      if (!reset || reset.reset_status !== 'PENDING' || reset.expires_at.getTime() <= Date.now()) {
        throw new BadRequestException('This password-reset link is invalid or has expired.');
      }

      const password = this.passwords.validate(dto.password, [
        reset.first_name ?? '', reset.last_name ?? '',
        reset.email_normalized.split('@')[0], reset.school_names ?? '',
      ]);
      if (reset.password_hash && await this.passwords.verify(reset.password_hash, password)) {
        throw new BadRequestException('Your new password must be different from your current password.');
      }
      const passwordHash = await this.passwords.hash(password);
      await client.query(`
        UPDATE users SET password_hash=$2,password_changed_at=NOW(),failed_login_count=0,locked_until=NULL,
          account_status=CASE WHEN account_status='LOCKED' THEN 'ACTIVE'::user_account_status ELSE account_status END,
          authentication_version=authentication_version+1,updated_at=NOW() WHERE id=$1
      `, [reset.user_id, passwordHash]);
      await client.query(`
        UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),
          revocation_reason=COALESCE(revocation_reason,'PASSWORD_RESET')
        WHERE user_id=$1 AND revoked_at IS NULL
      `, [reset.user_id]);
      await client.query(`
        UPDATE password_reset_requests SET
          reset_status=CASE WHEN id=$2 THEN 'CONSUMED'::password_reset_status ELSE 'REVOKED'::password_reset_status END,
          consumed_at=CASE WHEN id=$2 THEN NOW() ELSE consumed_at END,
          revoked_at=CASE WHEN id<>$2 THEN COALESCE(revoked_at,NOW()) ELSE revoked_at END,updated_at=NOW()
        WHERE user_id=$1 AND reset_status='PENDING'
      `, [reset.user_id, reset.reset_id]);
      await client.query(`
        INSERT INTO authentication_events(user_id,event_type,email_normalized,success,metadata)
        VALUES($1,'PASSWORD_RESET_COMPLETED',$2,TRUE,jsonb_build_object('resetRequestId',$3::text))
      `, [reset.user_id, reset.email_normalized, reset.reset_id]);
      return {
        resetRequestId: reset.reset_id, userId: reset.user_id,
        email: reset.email_original, firstName: reset.first_name,
      };
    });

    try {
      await this.email.sendPasswordChangedNotification({
        to: result.email, firstName: result.firstName, locale: 'fr',
        idempotencyKey: `password-changed/${result.resetRequestId}`,
      });
    } catch {
      // Notification failure must not roll back a completed password reset.
    }
    return { reset: true, redirectTo: '/login?passwordReset=1' };
  }
  private bearer(authorization?: string) {
    return authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
  }

  async requireSession(authorization?: string) {
    const rawToken = this.bearer(authorization);
    if (!this.tokens.isPlausible(rawToken)) throw new UnauthorizedException('Authentication required.');
    const result = await this.db.query<{
      session_id: string; user_id: string; authentication_version: number;
      current_authentication_version: number; expires_at: Date; idle_expires_at: Date;
      last_seen_at: Date; account_status: string; platform_role: 'SUPER_ADMIN' | null;
      first_name: string | null; last_name: string | null; email_original: string;
    }>(`
      SELECT sess.id session_id,sess.user_id,sess.authentication_version,
        usr.authentication_version current_authentication_version,sess.expires_at,sess.idle_expires_at,
        sess.last_seen_at,usr.account_status,usr.platform_role,usr.first_name,usr.last_name,usr.email_original
      FROM auth_sessions sess JOIN users usr ON usr.id=sess.user_id AND usr.deleted_at IS NULL
      WHERE sess.token_hash=$1 AND sess.revoked_at IS NULL LIMIT 1
    `, [this.tokens.hash(rawToken)]);
    const session = result.rows[0];
    const invalid = !session || session.account_status !== 'ACTIVE' ||
      session.authentication_version !== session.current_authentication_version ||
      session.expires_at.getTime() <= Date.now() || session.idle_expires_at.getTime() <= Date.now();
    if (invalid) {
      if (session?.session_id) {
        await this.db.query(`
          UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),
            revocation_reason=COALESCE(revocation_reason,'SESSION_INVALID') WHERE id=$1
        `, [session.session_id]);
      }
      throw new UnauthorizedException('Authentication required.');
    }
    if (session.last_seen_at.getTime() < Date.now() - 300_000) {
      await this.db.query(`
        UPDATE auth_sessions SET last_seen_at=NOW(),
          idle_expires_at=LEAST(expires_at,NOW()+($2*INTERVAL '1 minute'))
        WHERE id=$1 AND revoked_at IS NULL
      `, [session.session_id, this.idleMinutes()]);
    }
    const roles = await this.db.query<{ school_id: string; role_code: string }>(`
      SELECT sm.school_id,smr.role::text role_code FROM school_memberships sm
      JOIN school_membership_roles smr ON smr.school_membership_id=sm.id
      WHERE sm.user_id=$1 AND sm.membership_status='ACTIVE' AND sm.deleted_at IS NULL AND smr.deleted_at IS NULL
      ORDER BY sm.school_id,smr.role
    `, [session.user_id]);
    return {
      session_id: session.session_id, user_id: session.user_id,
      platform_role: session.platform_role, first_name: session.first_name, last_name: session.last_name,
      email: session.email_original, user_email: session.email_original, user_status: session.account_status,
      expires_at: session.expires_at.toISOString(), revoked_at: null,
      school_roles: roles.rows.map((role) => ({ schoolId: role.school_id, roleCode: role.role_code })),
    };
  }

  async logout(authorization?: string) {
    const rawToken = this.bearer(authorization);
    if (this.tokens.isPlausible(rawToken)) {
      await this.db.query(`
        UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),
          revocation_reason=COALESCE(revocation_reason,'USER_LOGOUT') WHERE token_hash=$1
      `, [this.tokens.hash(rawToken)]);
    }
    return { loggedOut: true };
  }

  async logoutAll(authorization?: string) {
    const session = await this.requireSession(authorization);
    await this.db.withTransaction(async (client) => {
      await client.query(
        `UPDATE users SET authentication_version=authentication_version+1,updated_at=NOW() WHERE id=$1`,
        [session.user_id],
      );
      await client.query(`
        UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),
          revocation_reason=COALESCE(revocation_reason,'LOGOUT_ALL')
        WHERE user_id=$1 AND revoked_at IS NULL
      `, [session.user_id]);
      await client.query(`
        INSERT INTO authentication_events(user_id,event_type,email_normalized,success)
        SELECT id,'LOGOUT_ALL',email_normalized,TRUE FROM users WHERE id=$1
      `, [session.user_id]);
    });
    return { loggedOutAll: true };
  }
}
