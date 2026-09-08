import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('school student directory integration', () => {
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

  it('paginates and filters within the requested school', async () => {
    const schoolId = await factory.school();
    const otherSchoolId = await factory.school();
    const scope = await factory.academicScope(schoolId);
    const studentIds: string[] = [];

    for (let index = 0; index < 11; index += 1) {
      const studentId = await factory.student(schoolId);
      studentIds.push(studentId);
      await pool.query(
        `
        UPDATE students
        SET first_name = $2, last_name = $3
        WHERE id = $1
        `,
        [studentId, `Student ${String(index).padStart(2, '0')}`, 'Directory'],
      );
    }

    await factory.student(otherSchoolId);
    await factory.enrollment(studentIds[0], scope);
    const guardianId = await factory.guardian(schoolId, {
      email: 'guardian-search@example.test',
    });
    await factory.studentGuardian(schoolId, studentIds[1], guardianId);

    const firstPage = await harness.schoolStudents.listStudents({
      schoolId,
      page: 1,
      pageSize: 10,
    });
    const secondPage = await harness.schoolStudents.listStudents({
      schoolId,
      page: 2,
      pageSize: 10,
    });

    expect(firstPage.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 11,
      pageCount: 2,
    });
    expect(firstPage.items).toHaveLength(10);
    expect(secondPage.items).toHaveLength(1);
    expect(
      new Set([...firstPage.items, ...secondPage.items].map((item) => item.id))
        .size,
    ).toBe(11);

    await expect(
      harness.schoolStudents.listStudents({
        schoolId,
        search: 'guardian-search@example.test',
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      items: [{ id: studentIds[1] }],
      pagination: { total: 1 },
    });

    await expect(
      harness.schoolStudents.listStudents({
        schoolId,
        gradeLevelId: scope.gradeLevelId,
        enrollmentState: 'ASSIGNED',
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({
      items: [{ id: studentIds[0] }],
      pagination: { total: 1 },
    });

    const unassigned = await harness.schoolStudents.listStudents({
      schoolId,
      enrollmentState: 'UNASSIGNED',
      page: 1,
      pageSize: 10,
    });
    expect(unassigned.pagination.total).toBe(10);
    expect(
      unassigned.items.every((student) => student.currentEnrollment === null),
    ).toBe(true);
  });
});
