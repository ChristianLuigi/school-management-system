import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { Pool, PoolClient } from 'pg';

const MIGRATION_LOCK_NAMESPACE = 1_094_558_203;
const MIGRATION_LOCK_RESOURCE = 1_296_254_035;
const BASELINE_CONFIRMATION = 'BASELINE_EXISTING_SCHEMA';
const LAST_LEGACY_AUTOCOMMIT_MIGRATION = '053_academic_quick_setup_indexes.sql';

const REQUIRED_BASELINE_TABLES = [
  'public.schools',
  'public.users',
  'public.school_memberships',
  'public.school_membership_roles',
  'public.auth_sessions',
  'public.user_invitations',
  'public.password_reset_requests',
  'public.guardians',
  'public.students',
  'public.student_guardians',
  'public.academic_years',
  'public.sections',
  'public.school_subjects',
  'public.school_staff_accounts',
  'public.guardian_account_links',
  'public.teacher_academic_assignments',
  'public.school_user_permissions',
  'public.payroll_staff_profiles',
  'public.payroll_runs',
  'public.payroll_run_items',
  'public.payroll_run_sequences',
] as const;

const REQUIRED_BASELINE_COLUMNS = [
  ['users', 'email_normalized'],
  ['users', 'account_status'],
  ['users', 'authentication_version'],
  ['auth_sessions', 'authentication_version'],
  ['auth_sessions', 'idle_expires_at'],
  ['user_invitations', 'guardian_id'],
  ['user_invitations', 'initial_permission_codes'],
  ['payroll_staff_profiles', 'staff_code'],
  ['payroll_staff_profiles', 'position_title'],
  ['payroll_staff_profiles', 'employment_type'],
  ['payroll_staff_profiles', 'pay_frequency'],
  ['payroll_runs', 'payroll_status'],
  ['payroll_runs', 'currency_code'],
  ['payroll_run_items', 'paid_at'],
  ['payroll_run_items', 'payment_method'],
  ['payroll_run_items', 'payment_reference'],
] as const;

export type MigrationState = 'applied' | 'pending';

export type MigrationStatus = {
  name: string;
  checksum: string;
  state: MigrationState;
  appliedAt: Date | null;
  executionMs: number | null;
  baseline: boolean;
};

type MigrationFile = {
  name: string;
  checksum: string;
  sql: string;
};

type AppliedMigrationRow = {
  migration_name: string;
  checksum: string;
  applied_at: Date;
  execution_ms: number;
  baseline: boolean;
};

export type MigrationRunnerOptions = {
  databaseUrl: string;
  migrationsDirectory: string;
  applicationVersion?: string;
  pool?: Pool;
};

export type BaselineOptions = {
  through: string;
  confirmation: string;
};

function checksum(contents: Buffer) {
  /*
   * Git may check text files out with platform-specific line endings.
   * Migration identity must remain stable between Windows workstations,
   * Linux CI, and production containers.
   */
  const canonicalContents = contents
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');

  return createHash('sha256').update(canonicalContents, 'utf8').digest('hex');
}

function bytewiseSort(left: string, right: string) {
  return Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8'));
}

function outerTransactionBody(sql: string) {
  const normalized = sql.replace(/^\uFEFF/, '');
  const match = normalized.match(
    /^\s*BEGIN\s*;\s*([\s\S]*?)\s*COMMIT\s*;\s*$/i,
  );

  return match?.[1] ?? null;
}

function normalizedSql(sql: string) {
  return sql.replace(/^\uFEFF/, '');
}

function splitPostgresStatements(sql: string) {
  const statements: string[] = [];
  let statementStart = 0;
  let index = 0;
  let state:
    | 'normal'
    | 'single'
    | 'double'
    | 'line-comment'
    | 'block-comment'
    | 'dollar' = 'normal';
  let blockDepth = 0;
  let dollarTag = '';

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];

    if (state === 'normal') {
      if (current === '-' && next === '-') {
        state = 'line-comment';
        index += 2;
        continue;
      }
      if (current === '/' && next === '*') {
        state = 'block-comment';
        blockDepth = 1;
        index += 2;
        continue;
      }
      if (current === "'") {
        state = 'single';
        index += 1;
        continue;
      }
      if (current === '"') {
        state = 'double';
        index += 1;
        continue;
      }
      if (current === '$') {
        const tag = sql
          .slice(index)
          .match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
        if (tag) {
          state = 'dollar';
          dollarTag = tag;
          index += tag.length;
          continue;
        }
      }
      if (current === ';') {
        const statement = sql.slice(statementStart, index).trim();
        if (statement) statements.push(statement);
        statementStart = index + 1;
      }
      index += 1;
      continue;
    }

    if (state === 'line-comment') {
      if (current === '\n') state = 'normal';
      index += 1;
      continue;
    }

    if (state === 'block-comment') {
      if (current === '/' && next === '*') {
        blockDepth += 1;
        index += 2;
        continue;
      }
      if (current === '*' && next === '/') {
        blockDepth -= 1;
        index += 2;
        if (blockDepth === 0) state = 'normal';
        continue;
      }
      index += 1;
      continue;
    }

    if (state === 'single') {
      if (current === "'" && next === "'") {
        index += 2;
        continue;
      }
      if (current === "'") state = 'normal';
      index += 1;
      continue;
    }

    if (state === 'double') {
      if (current === '"' && next === '"') {
        index += 2;
        continue;
      }
      if (current === '"') state = 'normal';
      index += 1;
      continue;
    }

    if (state === 'dollar') {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length;
        state = 'normal';
        dollarTag = '';
        continue;
      }
      index += 1;
    }
  }

  if (state !== 'normal' && state !== 'line-comment') {
    throw new Error('Migration contains an unterminated SQL construct.');
  }

  const tail = sql.slice(statementStart).trim();
  if (tail) statements.push(tail);
  return statements;
}

export class MigrationRunner {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;

  constructor(private readonly options: MigrationRunnerOptions) {
    if (!options.databaseUrl) {
      throw new Error('DATABASE_URL is required for database migrations.');
    }

    this.pool =
      options.pool ?? new Pool({ connectionString: options.databaseUrl });
    this.ownsPool = !options.pool;
  }

  static baselineConfirmation() {
    return BASELINE_CONFIRMATION;
  }

  async close() {
    if (this.ownsPool) {
      await this.pool.end();
    }
  }

  async status(): Promise<MigrationStatus[]> {
    return this.withLock(async (client) => {
      await this.ensureHistoryTable(client);
      const files = await this.discoverMigrations();
      const applied = await this.loadApplied(client);
      this.assertAppliedFilesAreUnchanged(files, applied);

      return files.map((migration) => {
        const row = applied.get(migration.name);

        return {
          name: migration.name,
          checksum: migration.checksum,
          state: row ? 'applied' : 'pending',
          appliedAt: row?.applied_at ?? null,
          executionMs: row?.execution_ms ?? null,
          baseline: row?.baseline ?? false,
        };
      });
    });
  }

  async verify() {
    const statuses = await this.status();
    const pending = statuses.filter(
      (migration) => migration.state === 'pending',
    );

    if (pending.length) {
      throw new Error(
        `Database has ${pending.length} pending migration(s): ${pending
          .map((migration) => migration.name)
          .join(', ')}`,
      );
    }

    return {
      verified: true,
      migrationCount: statuses.length,
      baselineCount: statuses.filter((migration) => migration.baseline).length,
    };
  }

  async up() {
    return this.withLock(async (client) => {
      await this.ensureHistoryTable(client);
      const files = await this.discoverMigrations();
      const applied = await this.loadApplied(client);
      this.assertAppliedFilesAreUnchanged(files, applied);

      const pending = files.filter((migration) => !applied.has(migration.name));
      const appliedNames: string[] = [];

      for (const migration of pending) {
        await this.applyMigration(client, migration);
        appliedNames.push(migration.name);
      }

      return {
        applied: appliedNames,
        appliedCount: appliedNames.length,
        totalCount: files.length,
      };
    });
  }

  async baseline(input: BaselineOptions) {
    if (input.confirmation !== BASELINE_CONFIRMATION) {
      throw new Error(`Baseline requires --confirm ${BASELINE_CONFIRMATION}.`);
    }

    return this.withLock(async (client) => {
      await this.ensureHistoryTable(client);
      const applied = await this.loadApplied(client);

      if (applied.size) {
        throw new Error(
          'Baseline is only allowed when schema_migrations is empty.',
        );
      }

      const files = await this.discoverMigrations();
      const throughIndex = files.findIndex(
        (migration) => migration.name === input.through,
      );

      if (throughIndex < 0) {
        throw new Error(`Baseline migration not found: ${input.through}`);
      }

      await this.assertExistingSchemaMatchesBaselineContract(client);

      const baselineFiles = files.slice(0, throughIndex + 1);
      await client.query('BEGIN');

      try {
        for (const migration of baselineFiles) {
          await client.query(
            `
            INSERT INTO schema_migrations (
              migration_name,
              checksum,
              execution_ms,
              application_version,
              baseline
            )
            VALUES ($1, $2, 0, $3, TRUE)
            `,
            [
              migration.name,
              migration.checksum,
              this.options.applicationVersion ?? null,
            ],
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      return {
        baselined: baselineFiles.map((migration) => migration.name),
        baselineCount: baselineFiles.length,
        through: input.through,
      };
    });
  }

  private async withLock<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('SELECT pg_advisory_lock($1::integer, $2::integer)', [
        MIGRATION_LOCK_NAMESPACE,
        MIGRATION_LOCK_RESOURCE,
      ]);

      return await callback(client);
    } finally {
      try {
        await client.query(
          'SELECT pg_advisory_unlock($1::integer, $2::integer)',
          [MIGRATION_LOCK_NAMESPACE, MIGRATION_LOCK_RESOURCE],
        );
      } finally {
        client.release();
      }
    }
  }

  private async ensureHistoryTable(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name TEXT PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_ms INTEGER NOT NULL CHECK (execution_ms >= 0),
        application_version TEXT,
        baseline BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
  }

  private async discoverMigrations(): Promise<MigrationFile[]> {
    let entries: Dirent[];

    try {
      entries = await fs.readdir(this.options.migrationsDirectory, {
        withFileTypes: true,
      });
    } catch (error) {
      throw new Error(
        `Unable to read migrations directory: ${this.options.migrationsDirectory}`,
        { cause: error },
      );
    }

    const names = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name)
      .sort(bytewiseSort);

    if (!names.length) {
      throw new Error('No SQL migration files were found.');
    }

    const caseInsensitiveNames = new Set<string>();
    for (const name of names) {
      const normalized = name.toLocaleLowerCase('en-US');
      if (caseInsensitiveNames.has(normalized)) {
        throw new Error(`Duplicate migration filename detected: ${name}`);
      }
      caseInsensitiveNames.add(normalized);
    }

    for (const name of names) {
      if (
        bytewiseSort(name, LAST_LEGACY_AUTOCOMMIT_MIGRATION) > 0 &&
        outerTransactionBody(
          await fs.readFile(
            path.join(this.options.migrationsDirectory, name),
            'utf8',
          ),
        ) === null
      ) {
        throw new Error(
          `New migration must use an outer BEGIN/COMMIT transaction: ${name}`,
        );
      }
    }

    return Promise.all(
      names.map(async (name) => {
        const migrationPath = path.join(this.options.migrationsDirectory, name);
        const contents = await fs.readFile(migrationPath);
        const sql = contents.toString('utf8');

        if (!contents.length || !sql.trim()) {
          throw new Error(`Migration is empty: ${name}`);
        }
        if (sql.includes('\uFFFD')) {
          throw new Error(`Migration is not valid UTF-8: ${name}`);
        }

        return {
          name,
          checksum: checksum(contents),
          sql,
        };
      }),
    );
  }

  private async loadApplied(client: PoolClient) {
    const result = await client.query<AppliedMigrationRow>(`
      SELECT
        migration_name,
        checksum,
        applied_at,
        execution_ms,
        baseline
      FROM schema_migrations
      ORDER BY migration_name
    `);

    return new Map(
      result.rows.map((row) => [row.migration_name, row] as const),
    );
  }

  private assertAppliedFilesAreUnchanged(
    files: MigrationFile[],
    applied: Map<string, AppliedMigrationRow>,
  ) {
    const filesByName = new Map(
      files.map((migration) => [migration.name, migration] as const),
    );

    for (const [name, row] of applied) {
      const file = filesByName.get(name);
      if (!file) {
        throw new Error(`Applied migration file is missing: ${name}`);
      }
      if (file.checksum !== row.checksum.trim()) {
        throw new Error(`Applied migration checksum has changed: ${name}`);
      }
    }
  }

  private async applyMigration(client: PoolClient, migration: MigrationFile) {
    const startedAt = performance.now();
    const transactionBody = outerTransactionBody(migration.sql);

    try {
      if (transactionBody !== null) {
        await client.query('BEGIN');
        await client.query(transactionBody);
      } else {
        const statements = splitPostgresStatements(
          normalizedSql(migration.sql),
        );
        for (const statement of statements) {
          await client.query(statement);
        }
        await client.query('BEGIN');
      }

      const executionMs = Math.max(
        0,
        Math.round(performance.now() - startedAt),
      );

      await client.query(
        `
        INSERT INTO schema_migrations (
          migration_name,
          checksum,
          execution_ms,
          application_version,
          baseline
        )
        VALUES ($1, $2, $3, $4, FALSE)
        `,
        [
          migration.name,
          migration.checksum,
          executionMs,
          this.options.applicationVersion ?? null,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error(`Migration failed: ${migration.name}`, { cause: error });
    }
  }

  private async assertExistingSchemaMatchesBaselineContract(
    client: PoolClient,
  ) {
    const missingTables: string[] = [];

    for (const table of REQUIRED_BASELINE_TABLES) {
      const result = await client.query<{ relation: string | null }>(
        'SELECT to_regclass($1)::text AS relation',
        [table],
      );
      if (!result.rows[0]?.relation) {
        missingTables.push(table);
      }
    }

    const missingColumns: string[] = [];
    for (const [table, column] of REQUIRED_BASELINE_COLUMNS) {
      const result = await client.query<{ present: boolean }>(
        `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS present
        `,
        [table, column],
      );
      if (!result.rows[0]?.present) {
        missingColumns.push(`${table}.${column}`);
      }
    }

    if (missingTables.length || missingColumns.length) {
      throw new Error(
        [
          'Existing database does not satisfy the release baseline contract.',
          missingTables.length
            ? `Missing tables: ${missingTables.join(', ')}.`
            : '',
          missingColumns.length
            ? `Missing columns: ${missingColumns.join(', ')}.`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
    }
  }
}
