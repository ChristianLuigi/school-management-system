import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('student onboarding integration', () => {
  let pool: Pool;
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let factory: IntegrationFactory;

  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    factory = new IntegrationFactory(
      pool,
      harness.passwords,
      harness.sessionTokens,
    );
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(pool);
  });

  afterAll(async () => {
    await harness.close();
    await pool.end();
  });

  it('creates a registered student until a school-scoped class is assigned', async () => {
    const schoolId = await factory.school();
    const otherSchoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const scope = await factory.academicScope(schoolId);
    const otherScope = await factory.academicScope(otherSchoolId);

    const pending = await harness.schoolStudents.createStudent(
      {
        schoolId,
        firstName: '  Ada  ',
        lastName: '  Pierre  ',
        studentCode: ' sa-300 ',
      },
      admin.id,
      null,
    );
    expect(pending).toMatchObject({
      studentCode: 'SA-300',
      studentStatus: 'REGISTERED',
      sectionId: null,
    });
    const initialStatusResult = await pool.query<{
      previous_status: string | null;
      new_status: string;
    }>(
      `
      SELECT previous_status::text, new_status::text
      FROM student_status_history
      WHERE student_id = $1
      `,
      [pending.id],
    );
    expect(initialStatusResult.rows).toEqual([
      { previous_status: null, new_status: 'REGISTERED' },
    ]);

    const active = await harness.schoolStudents.createStudent(
      {
        schoolId,
        firstName: 'Jean',
        lastName: 'Louis',
        sectionId: scope.sectionId,
      },
      admin.id,
      null,
    );
    expect(active).toMatchObject({
      studentStatus: 'ACTIVE',
      sectionId: scope.sectionId,
    });

    const enrollmentResult = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM enrollments
      WHERE student_id = $1
        AND section_id = $2
        AND enrollment_status = 'ACTIVE'
        AND deleted_at IS NULL
      `,
      [active.id, scope.sectionId],
    );
    expect(Number(enrollmentResult.rows[0]?.count ?? 0)).toBe(1);

    await expect(
      harness.schoolStudents.createStudent(
        {
          schoolId,
          firstName: 'Duplicate',
          lastName: 'Code',
          studentCode: 'SA-300',
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      harness.schoolStudents.createStudent(
        {
          schoolId,
          firstName: 'Future',
          lastName: 'Birthdate',
          dateOfBirth: '2999-01-01',
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      harness.schoolStudents.createStudent(
        {
          schoolId,
          firstName: 'Cross',
          lastName: 'School',
          sectionId: otherScope.sectionId,
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
