import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AuthService } from '../src/auth/auth.service';
import { AuthTokenService } from '../src/auth/security/auth-token.service';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('secure authentication integration', () => {
  let pool: Pool;
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let factory: IntegrationFactory;
  let auth: AuthService;
  let authTokens: AuthTokenService;

  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    auth = harness.auth;
    authTokens = harness.authTokens;
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

  it('authenticates a verified active user and returns a usable session', async () => {
    const user = await factory.user();

    const result = await auth.login({
      email: user.email.toUpperCase(),
      password: user.password,
    });
    const session = await auth.requireSession(
      `Bearer ${result.sessionToken}`,
    );

    expect(session.user_id).toBe(user.id);
    expect(session.email).toBe(user.email);
    expect(JSON.stringify(session)).not.toMatch(
      /password_hash|token_hash|authentication_version/i,
    );
  });

  it('uses the same safe authentication failure for an unknown email and bad password', async () => {
    const user = await factory.user();

    await expect(
      auth.login({
        email: user.email,
        password: 'Incorrect Password 42!Stone',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Email or password is incorrect.',
      },
    });

    await expect(
      auth.login({
        email: 'unknown-account@release.test',
        password: 'Incorrect Password 42!Stone',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Email or password is incorrect.',
      },
    });
  });

  it('rejects malformed, revoked, expired, and authentication-version-invalid sessions', async () => {
    const user = await factory.user();
    const revoked = await factory.session(user.id, { revoked: true });
    const expired = await factory.session(user.id, { expired: true });
    const versioned = await factory.session(user.id);

    await expect(
      auth.requireSession('Bearer malformed'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.requireSession(`Bearer ${revoked.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.requireSession(`Bearer ${expired.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await pool.query(
      `
      UPDATE users
      SET authentication_version = authentication_version + 1
      WHERE id = $1
      `,
      [user.id],
    );

    await expect(
      auth.requireSession(`Bearer ${versioned.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const invalidated = await pool.query<{
      revoked_at: Date | null;
      revocation_reason: string | null;
    }>(
      `
      SELECT revoked_at, revocation_reason
      FROM auth_sessions
      WHERE id = $1
      `,
      [versioned.id],
    );
    expect(invalidated.rows[0].revoked_at).not.toBeNull();
    expect(invalidated.rows[0].revocation_reason).toBe('SESSION_INVALID');
  });

  it('revokes the current session on logout without disclosing whether a token existed', async () => {
    const user = await factory.user();
    const session = await factory.session(user.id);

    await expect(
      auth.logout(`Bearer ${session.rawToken}`),
    ).resolves.toEqual({ loggedOut: true });
    await expect(
      auth.logout('Bearer deliberately-invalid-token-value-that-is-long-enough'),
    ).resolves.toEqual({ loggedOut: true });
    await expect(
      auth.requireSession(`Bearer ${session.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('keeps password-reset requests non-enumerating', async () => {
    const user = await factory.user();

    const existing = await auth.requestPasswordReset({
      email: user.email,
      locale: 'en',
    });
    const unknown = await auth.requestPasswordReset({
      email: 'not-present@release.test',
      locale: 'en',
    });

    expect(existing).toEqual(unknown);
    expect(existing).toEqual({
      accepted: true,
      message:
        'If an eligible account exists for this email, password-reset instructions will be sent.',
    });
    expect(harness.email.passwordResets).toHaveLength(1);
  });

  it('consumes password-reset tokens once and revokes every existing session', async () => {
    const user = await factory.user();
    const session = await factory.session(user.id);
    await auth.requestPasswordReset({ email: user.email, locale: 'en' });

    const resetUrl = harness.email.passwordResets[0]?.resetUrl;
    const rawToken = resetUrl?.split('#token=')[1];
    expect(rawToken).toBeTruthy();

    await expect(
      auth.inspectPasswordReset(decodeURIComponent(rawToken ?? '')),
    ).resolves.toMatchObject({ valid: true });

    const newPassword = 'Night Harbor 94!Velvet Compass';
    await expect(
      auth.confirmPasswordReset({
        token: decodeURIComponent(rawToken ?? ''),
        password: newPassword,
        passwordConfirmation: newPassword,
      }),
    ).resolves.toEqual({
      reset: true,
      redirectTo: '/login?passwordReset=1',
    });

    await expect(
      auth.requireSession(`Bearer ${session.rawToken}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.inspectPasswordReset(decodeURIComponent(rawToken ?? '')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      auth.confirmPasswordReset({
        token: decodeURIComponent(rawToken ?? ''),
        password: 'Another Valid 64!Password Harbor',
        passwordConfirmation: 'Another Valid 64!Password Harbor',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      auth.login({ email: user.email, password: newPassword }),
    ).resolves.toHaveProperty('sessionToken');
  });

  it('rejects expired password-reset tokens', async () => {
    const user = await factory.user();
    const { rawToken, tokenHash } = authTokens.generate();

    await pool.query(
      `
      INSERT INTO password_reset_requests (
        user_id,
        token_hash,
        reset_status,
        expires_at,
        requested_at
      )
      VALUES ($1, $2, 'PENDING', NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 hour')
      `,
      [user.id, tokenHash],
    );

    await expect(
      auth.inspectPasswordReset(rawToken),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
