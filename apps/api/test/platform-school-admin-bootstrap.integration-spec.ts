import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { PlatformSchoolsService } from '../src/platform-schools/platform-schools.service';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('platform school administrator bootstrap integration', () => {
  let pool: Pool;
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let factory: IntegrationFactory;
  let platformSchools: PlatformSchoolsService;

  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    factory = new IntegrationFactory(
      pool,
      harness.passwords,
      harness.sessionTokens,
    );
    platformSchools = new PlatformSchoolsService(harness.db, harness.activity);
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(pool);
  });

  afterAll(async () => {
    await harness.close();
    await pool.end();
  });

  it('creates the first administrator with active staff-management access', async () => {
    const created = await platformSchools.create({
      name: 'Bootstrap School',
      defaultLocale: 'fr',
      timezone: 'America/Port-au-Prince',
      currencyCode: 'HTG',
      countryCode: 'HT',
      initialLevels: ['PRIM'],
      firstAdmin: {
        email: 'first.admin@example.test',
        temporaryPassword: 'Temporary-Password-2026!',
        firstName: 'First',
        lastName: 'Administrator',
      },
    });

    const staff = await pool.query<{
      user_id: string;
      staff_type: string;
      staff_category: string;
      employment_status: string;
    }>(
      `
      SELECT
        user_id,
        staff_type,
        staff_category,
        employment_status
      FROM school_staff_accounts
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      `,
      [created.school.id, created.firstAdmin.id],
    );

    expect(staff.rows).toEqual([
      {
        user_id: created.firstAdmin.id,
        staff_type: 'SCHOOL_ADMIN',
        staff_category: 'SCHOOL_LEADERSHIP',
        employment_status: 'ACTIVE',
      },
    ]);

    await expect(
      harness.staffManagement.listStaff(
        {
          schoolId: created.school.id,
          page: 1,
          pageSize: 25,
        },
        created.firstAdmin.id,
      ),
    ).resolves.toMatchObject({
      pagination: {
        total: 1,
      },
    });
  });

  it('creates an additional administrator with active staff-management access', async () => {
    const created = await platformSchools.create({
      name: 'Additional Administrator School',
      defaultLocale: 'en',
      timezone: 'America/Port-au-Prince',
      currencyCode: 'HTG',
      countryCode: 'HT',
      initialLevels: ['SEC'],
      firstAdmin: {
        email: 'original.admin@example.test',
        temporaryPassword: 'Temporary-Password-2026!',
      },
    });
    const additionalAdmin = await platformSchools.createSchoolStaff(
      created.school.id,
      {
        email: 'additional.admin@example.test',
        temporaryPassword: 'Temporary-Password-2026!',
        firstName: 'Additional',
        lastName: 'Administrator',
        role: 'SCHOOL_ADMIN',
      },
    );

    await expect(
      harness.staffManagement.listStaff(
        {
          schoolId: created.school.id,
          page: 1,
          pageSize: 25,
        },
        additionalAdmin.id,
      ),
    ).resolves.toMatchObject({
      pagination: {
        total: 2,
      },
    });
  });

  it('backfills a missing staff record without duplicating it', async () => {
    const schoolId = await factory.school();
    const administrator = await factory.user({
      email: 'legacy.admin@example.test',
      firstName: 'Legacy',
      lastName: 'Administrator',
    });
    await factory.membership(schoolId, administrator.id, 'SCHOOL_ADMIN');
    const migration = await readFile(
      resolve(
        __dirname,
        '../../../infra/db/migrations/071_school_admin_staff_bootstrap.sql',
      ),
      'utf8',
    );

    await pool.query(migration);
    await pool.query(migration);

    const result = await pool.query<{
      count: string;
      employment_status: string;
    }>(
      `
      SELECT
        COUNT(*)::TEXT AS count,
        MAX(employment_status) AS employment_status
      FROM school_staff_accounts
      WHERE school_id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      `,
      [schoolId, administrator.id],
    );
    expect(result.rows[0]).toEqual({
      count: '1',
      employment_status: 'ACTIVE',
    });
  });
});