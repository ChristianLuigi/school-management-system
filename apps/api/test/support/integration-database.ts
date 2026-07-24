import { Pool } from 'pg';

export function integrationDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error('TEST_DATABASE_URL is required.');
  }
  return value;
}

export function createIntegrationPool() {
  return new Pool({ connectionString: integrationDatabaseUrl() });
}

export async function resetIntegrationDatabase(pool: Pool) {
  const databaseResult = await pool.query<{ database_name: string }>(
    'SELECT current_database() AS database_name',
  );
  const databaseName = databaseResult.rows[0]?.database_name.toLowerCase() ?? '';

  if (!databaseName.includes('test') && !databaseName.includes('rr_')) {
    throw new Error(
      `Refusing to reset non-test database: ${databaseName || '<unknown>'}`,
    );
  }

  const tables = await pool.query<{ tablename: string }>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'schema_migrations'
    ORDER BY tablename
  `);

  if (!tables.rows.length) {
    throw new Error(
      'Integration database has no application tables. Apply migrations first.',
    );
  }

  const identifiers = tables.rows
    .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
    .join(', ');

  await pool.query(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`);
}
