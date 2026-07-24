import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { MigrationRunner } from '../src/database-migrations/migration-runner';

type DisposableDatabase = {
  name: string;
  url: string;
};

describe('database migration runner integration', () => {
  const adminUrl =
    process.env.TEST_DATABASE_ADMIN_URL ??
    (() => {
      const value = new URL(process.env.TEST_DATABASE_URL ?? '');
      value.pathname = '/postgres';
      return value.toString();
    })();
  const adminPool = new Pool({ connectionString: adminUrl });
  const databases = new Set<string>();
  const directories = new Set<string>();

  async function createDatabase(): Promise<DisposableDatabase> {
    const name = `school_mgmt_test_${randomUUID().replaceAll('-', '')}`;
    await adminPool.query(`CREATE DATABASE "${name}"`);
    databases.add(name);
    const value = new URL(adminUrl);
    value.pathname = `/${name}`;
    return { name, url: value.toString() };
  }

  async function migrationDirectory() {
    const directory = await mkdtemp(path.join(tmpdir(), 'almac-migrations-'));
    directories.add(directory);
    return directory;
  }

  afterEach(async () => {
    for (const name of databases) {
      await adminPool.query(
        `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
        `,
        [name],
      );
      await adminPool.query(`DROP DATABASE "${name}"`);
    }
    databases.clear();

    for (const directory of directories) {
      await rm(directory, { recursive: true, force: true });
    }
    directories.clear();
  });

  afterAll(async () => {
    await adminPool.end();
  });

  it('applies duplicate numeric prefixes, verifies checksums, and becomes a no-op', async () => {
    const database = await createDatabase();
    const directory = await migrationDirectory();
    await writeFile(
      path.join(directory, '001_alpha.sql'),
      'CREATE TABLE alpha (id INTEGER PRIMARY KEY);',
    );
    await writeFile(
      path.join(directory, '001_beta.sql'),
      'CREATE TABLE beta (id INTEGER PRIMARY KEY);',
    );
    const runner = new MigrationRunner({
      databaseUrl: database.url,
      migrationsDirectory: directory,
      applicationVersion: 'integration-test',
    });

    try {
      await expect(runner.up()).resolves.toMatchObject({
        appliedCount: 2,
        totalCount: 2,
      });
      await expect(runner.verify()).resolves.toMatchObject({
        verified: true,
        migrationCount: 2,
      });
      await expect(runner.up()).resolves.toMatchObject({
        appliedCount: 0,
        totalCount: 2,
      });
    } finally {
      await runner.close();
    }
  });

  it('detects changes to an applied migration checksum', async () => {
    const database = await createDatabase();
    const directory = await migrationDirectory();
    const migrationPath = path.join(directory, '001_checksum.sql');
    await writeFile(migrationPath, 'CREATE TABLE checksum_a (id INTEGER);');
    const runner = new MigrationRunner({
      databaseUrl: database.url,
      migrationsDirectory: directory,
    });

    try {
      await runner.up();
      await writeFile(migrationPath, 'CREATE TABLE checksum_b (id INTEGER);');
      await expect(runner.status()).rejects.toThrow(
        'Applied migration checksum has changed: 001_checksum.sql',
      );
    } finally {
      await runner.close();
    }
  });

  it('keeps migration checksums stable across LF and CRLF checkouts', async () => {
    const database = await createDatabase();
    const directory = await migrationDirectory();
    const migrationPath = path.join(directory, '001_line_endings.sql');
    await writeFile(
      migrationPath,
      'BEGIN;\r\nCREATE TABLE line_endings (id INTEGER);\r\nCOMMIT;\r\n',
    );
    const runner = new MigrationRunner({
      databaseUrl: database.url,
      migrationsDirectory: directory,
    });

    try {
      await runner.up();
      await writeFile(
        migrationPath,
        'BEGIN;\nCREATE TABLE line_endings (id INTEGER);\nCOMMIT;\n',
      );

      await expect(runner.verify()).resolves.toMatchObject({
        verified: true,
        migrationCount: 1,
      });
    } finally {
      await runner.close();
    }
  });

  it('rolls back a failed transactional migration', async () => {
    const database = await createDatabase();
    const directory = await migrationDirectory();
    await writeFile(
      path.join(directory, '054_atomic_failure.sql'),
      `
      BEGIN;
      CREATE TABLE should_rollback (id INTEGER);
      SELECT missing_column FROM should_rollback;
      COMMIT;
      `,
    );
    const runner = new MigrationRunner({
      databaseUrl: database.url,
      migrationsDirectory: directory,
    });

    try {
      await expect(runner.up()).rejects.toThrow(
        'Migration failed: 054_atomic_failure.sql',
      );
      const pool = new Pool({ connectionString: database.url });
      try {
        const result = await pool.query<{ relation: string | null }>(
          `SELECT to_regclass('public.should_rollback')::text AS relation`,
        );
        expect(result.rows[0].relation).toBeNull();
      } finally {
        await pool.end();
      }
    } finally {
      await runner.close();
    }
  });

  it('serializes concurrent migration attempts with an advisory lock', async () => {
    const database = await createDatabase();
    const directory = await migrationDirectory();
    await writeFile(
      path.join(directory, '054_concurrent.sql'),
      `
      BEGIN;
      SELECT pg_sleep(0.2);
      CREATE TABLE concurrent_migration (id INTEGER PRIMARY KEY);
      COMMIT;
      `,
    );
    const first = new MigrationRunner({
      databaseUrl: database.url,
      migrationsDirectory: directory,
    });
    const second = new MigrationRunner({
      databaseUrl: database.url,
      migrationsDirectory: directory,
    });

    try {
      const results = await Promise.all([first.up(), second.up()]);
      expect(results.map((result) => result.appliedCount).sort()).toEqual([
        0, 1,
      ]);
    } finally {
      await first.close();
      await second.close();
    }
  });

  it('applies and verifies the complete production migration chain', async () => {
    const database = await createDatabase();
    const migrationsDirectory = path.resolve(
      __dirname,
      '../../../infra/db/migrations',
    );
    const runner = new MigrationRunner({
      databaseUrl: database.url,
      migrationsDirectory,
      applicationVersion: 'integration-test',
    });

    try {
      await expect(runner.up()).resolves.toMatchObject({
        appliedCount: 63,
        totalCount: 63,
      });
      await expect(runner.verify()).resolves.toMatchObject({
        verified: true,
        migrationCount: 63,
      });

      const pool = new Pool({ connectionString: database.url });
      try {
        const legacyAccount = await pool.query<{
          account_status: string;
          disabled: boolean;
        }>(
          `
          SELECT
            account_status,
            password_hash = 'DISABLED_LEGACY_SEED' AS disabled
          FROM users
          WHERE id = '94444444-4444-4444-8444-444444444444'
          `,
        );
        expect(legacyAccount.rows[0]).toEqual({
          account_status: 'SUSPENDED',
          disabled: true,
        });

        await pool.query('TRUNCATE TABLE schema_migrations');
      } finally {
        await pool.end();
      }

      await expect(
        runner.baseline({
          through: '058_operational_user_access.sql',
          confirmation: 'WRONG_CONFIRMATION',
        }),
      ).rejects.toThrow('Baseline requires');
      await expect(
        runner.baseline({
          through: '058_operational_user_access.sql',
          confirmation: MigrationRunner.baselineConfirmation(),
        }),
      ).resolves.toMatchObject({
        baselineCount: 62,
        through: '058_operational_user_access.sql',
      });
      await expect(runner.up()).resolves.toMatchObject({
        applied: ['059_disable_legacy_seed_super_admin.sql'],
        appliedCount: 1,
      });
      await expect(runner.verify()).resolves.toMatchObject({
        verified: true,
        migrationCount: 63,
        baselineCount: 62,
      });
    } finally {
      await runner.close();
    }
  });
});
