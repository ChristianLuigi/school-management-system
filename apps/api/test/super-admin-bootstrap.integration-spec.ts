import { Pool } from 'pg';
import {
  SUPER_ADMIN_BOOTSTRAP_CONFIRMATION,
  SuperAdminBootstrapService,
} from '../src/platform-bootstrap/super-admin-bootstrap.service';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { createServiceHarness } from './support/service-harness';

describe('Super Admin bootstrap (integration)', () => {
  let pool: Pool;
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let service: SuperAdminBootstrapService;

  const input = {
    confirmation: SUPER_ADMIN_BOOTSTRAP_CONFIRMATION,
    email: 'owner@example.test',
    password: 'Cobalt river lantern 49!',
    firstName: 'Pilot',
    lastName: 'Owner',
  };

  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    service = new SuperAdminBootstrapService(pool, harness.passwords);
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(pool);
  });

  afterAll(async () => {
    await harness.close();
    await pool.end();
  });

  it('creates an audited account that can authenticate without exposing its password', async () => {
    const result = await service.bootstrap(input);
    const stored = await pool.query<{
      password_hash: string;
      account_status: string;
      platform_role: string;
      email_verified_at: Date | null;
    }>(
      `
      SELECT password_hash, account_status, platform_role, email_verified_at
      FROM users
      WHERE id = $1
      `,
      [result.userId],
    );

    expect(result.email).toBe(input.email);
    expect(typeof result.userId).toBe('string');
    expect(Number.isNaN(Date.parse(result.createdAt))).toBe(false);
    expect(JSON.stringify(result)).not.toContain(input.password);
    expect(stored.rows[0].account_status).toBe('ACTIVE');
    expect(stored.rows[0].platform_role).toBe('SUPER_ADMIN');
    expect(stored.rows[0].email_verified_at).toBeInstanceOf(Date);
    expect(stored.rows[0].password_hash).not.toBe(input.password);
    expect(
      await harness.passwords.verify(
        stored.rows[0].password_hash,
        input.password,
      ),
    ).toBe(true);

    const login = await harness.auth.login({
      email: input.email,
      password: input.password,
    });
    expect(login.user.platformRole).toBe('SUPER_ADMIN');
    expect(typeof login.sessionToken).toBe('string');

    const events = await pool.query<{ event_type: string }>(
      `
      SELECT event_type FROM authentication_events
      WHERE user_id = $1 AND event_type = 'SUPER_ADMIN_BOOTSTRAPPED'
      `,
      [result.userId],
    );
    const activities = await pool.query<{ event_type: string }>(
      `
      SELECT event_type FROM platform_activity_logs
      WHERE event_type = 'SUPER_ADMIN_BOOTSTRAPPED'
        AND payload ->> 'userId' = $1
      `,
      [result.userId],
    );
    expect(events.rowCount).toBe(1);
    expect(activities.rowCount).toBe(1);
  });

  it('refuses a second Super Admin', async () => {
    await service.bootstrap(input);

    await expect(
      service.bootstrap({
        ...input,
        email: 'second-owner@example.test',
      }),
    ).rejects.toThrow('A Super Admin already exists.');

    const count = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users WHERE platform_role = 'SUPER_ADMIN'`,
    );
    expect(count.rows[0].count).toBe('1');
  });

  it('requires explicit operator confirmation', async () => {
    await expect(
      service.bootstrap({ ...input, confirmation: 'yes' }),
    ).rejects.toThrow(SUPER_ADMIN_BOOTSTRAP_CONFIRMATION);

    const count = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM users',
    );
    expect(count.rows[0].count).toBe('0');
  });

  it('does not overwrite an existing account with the requested email', async () => {
    await pool.query(
      `
      INSERT INTO users (
        email,
        email_original,
        email_normalized,
        password_hash,
        status,
        account_status
      )
      VALUES ($1, $2, $3, 'unchanged-hash', 'ACTIVE', 'ACTIVE')
      `,
      [input.email, input.email, input.email],
    );

    await expect(service.bootstrap(input)).rejects.toThrow(
      'That email address already belongs to an account.',
    );
    const stored = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email_normalized = $1',
      [input.email],
    );
    expect(stored.rows[0].password_hash).toBe('unchanged-hash');
  });
});
