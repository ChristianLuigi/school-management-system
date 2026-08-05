import { randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
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

  async function waitForDatabaseConnectionsToClose(name: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await adminPool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
        `,
        [name],
      );

      if (Number(result.rows[0]?.count ?? 0) === 0) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  afterEach(async () => {
    for (const name of databases) {
      await waitForDatabaseConnectionsToClose(name);
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

  it('upgrades legacy linked staff without guessing payroll links', async () => {
    const database = await createDatabase();
    const directory = await migrationDirectory();
    const productionDirectory = path.resolve(
      __dirname,
      '../../../infra/db/migrations',
    );
    const migrationNames = (await readdir(productionDirectory))
      .filter((name) => name.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right));

    const legacyBaseMigrationNames = migrationNames.filter(
      (name) => name.localeCompare('067_staff_directory_foundation.sql') < 0,
    );

    for (const migrationName of legacyBaseMigrationNames) {
      await copyFile(
        path.join(productionDirectory, migrationName),
        path.join(directory, migrationName),
      );
    }

    const runner = new MigrationRunner({
      databaseUrl: database.url,
      migrationsDirectory: directory,
      applicationVersion: 'staff-upgrade-test',
    });
    const pool = new Pool({ connectionString: database.url });

    try {
      await expect(runner.up()).resolves.toMatchObject({
        appliedCount: legacyBaseMigrationNames.length,
        totalCount: legacyBaseMigrationNames.length,
      });
      const schoolId = randomUUID();
      const userId = randomUUID();
      const payrollProfileId = randomUUID();
      await pool.query(
        `
        INSERT INTO schools (
          id,
          code,
          name,
          currency_code,
          country_code,
          timezone,
          status,
          management_mode
        )
        VALUES (
          $1,
          $2,
          'Staff Upgrade School',
          'HTG',
          'HT',
          'America/Port-au-Prince',
          'ACTIVE',
          'SELF_MANAGED'
        )
        `,
        [schoolId, `UPGRADE-${schoolId.slice(0, 8)}`],
      );
      await pool.query(
        `
        INSERT INTO users (
          id,
          email,
          email_original,
          email_normalized,
          password_hash,
          preferred_locale,
          status,
          account_status,
          first_name,
          last_name
        )
        VALUES (
          $1,
          $2::text,
          $2::text,
          $2::text,
          'INTEGRATION_TEST_DISABLED_PASSWORD',
          'fr',
          'ACTIVE',
          'ACTIVE',
          'Legacy',
          'Employee'
        )
        `,
        [userId, `legacy-${userId.slice(0, 12)}@integration.test`],
      );
      await pool.query(
        `
        INSERT INTO school_staff_accounts (
          school_id,
          user_id,
          staff_code,
          staff_type,
          employment_status
        )
        VALUES ($1, $2, ' legacy-001 ', 'TEACHER', 'ACTIVE')
        `,
        [schoolId, userId],
      );
      await pool.query(
        `
        INSERT INTO payroll_staff_profiles (
          id,
          school_id,
          full_name,
          base_salary,
          currency_code,
          payroll_active
        )
        VALUES ($1, $2, 'Unverified Legacy Profile', 1000, 'HTG', TRUE)
        `,
        [payrollProfileId, schoolId],
      );

      await copyFile(
        path.join(productionDirectory, '067_staff_directory_foundation.sql'),
        path.join(directory, '067_staff_directory_foundation.sql'),
      );
      await expect(runner.up()).resolves.toMatchObject({
        applied: ['067_staff_directory_foundation.sql'],
        appliedCount: 1,
        totalCount: legacyBaseMigrationNames.length + 1,
      });

      const staff = await pool.query<{
        first_name: string;
        last_name: string;
        email_normalized: string;
        staff_code: string;
        staff_category: string;
        hire_date: string;
      }>(
        `
        SELECT
          first_name,
          last_name,
          email_normalized,
          staff_code,
          staff_category,
          hire_date::text
        FROM school_staff_accounts
        WHERE school_id = $1
          AND user_id = $2
        `,
        [schoolId, userId],
      );
      expect(staff.rows[0]).toMatchObject({
        first_name: 'Legacy',
        last_name: 'Employee',
        email_normalized: `legacy-${userId.slice(0, 12)}@integration.test`,
        staff_code: 'LEGACY-001',
        staff_category: 'TEACHING',
      });
      expect(staff.rows[0].hire_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const payrollProfile = await pool.query<{
        school_staff_account_id: string | null;
      }>(
        `
        SELECT school_staff_account_id
        FROM payroll_staff_profiles
        WHERE id = $1
        `,
        [payrollProfileId],
      );
      expect(payrollProfile.rows[0].school_staff_account_id).toBeNull();
    } finally {
      await pool.end();
      await runner.close();
    }
  });
  it('applies and verifies the complete production migration chain', async () => {
    const database = await createDatabase();
    const migrationsDirectory = path.resolve(
      __dirname,
      '../../../infra/db/migrations',
    );
    const migrationNames = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right));
    const migrationCount = migrationNames.length;
    const baselineThrough = '058_operational_user_access.sql';
    const baselineCount = migrationNames.filter(
      (name) => name.localeCompare(baselineThrough) <= 0,
    ).length;
    const postBaselineMigrations = migrationNames.slice(baselineCount);
    const runner = new MigrationRunner({
      databaseUrl: database.url,
      migrationsDirectory,
      applicationVersion: 'integration-test',
    });

    try {
      await expect(runner.up()).resolves.toMatchObject({
        appliedCount: migrationCount,
        totalCount: migrationCount,
      });
      await expect(runner.verify()).resolves.toMatchObject({
        verified: true,
        migrationCount,
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
      const baselineContractPool = new Pool({ connectionString: database.url });
      try {
        await baselineContractPool.query(
          'ALTER TABLE payroll_run_sequences RENAME TO payroll_run_sequences_missing',
        );
        await expect(
          runner.baseline({
            through: '058_operational_user_access.sql',
            confirmation: MigrationRunner.baselineConfirmation(),
          }),
        ).rejects.toThrow('Missing tables: public.payroll_run_sequences.');
      } finally {
        await baselineContractPool.query(
          'ALTER TABLE payroll_run_sequences_missing RENAME TO payroll_run_sequences',
        );
        await baselineContractPool.end();
      }
      await expect(
        runner.baseline({
          through: '058_operational_user_access.sql',
          confirmation: MigrationRunner.baselineConfirmation(),
        }),
      ).resolves.toMatchObject({
        baselineCount,
        through: '058_operational_user_access.sql',
      });
      await expect(runner.up()).resolves.toMatchObject({
        applied: postBaselineMigrations,
        appliedCount: postBaselineMigrations.length,
      });
      await expect(runner.verify()).resolves.toMatchObject({
        verified: true,
        migrationCount,
        baselineCount,
      });
    } finally {
      await runner.close();
    }
  });
});
