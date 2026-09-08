import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('student enrollment lifecycle integration', () => {
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

  async function administratorSchool() {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    return { schoolId, admin };
  }

  it('rejects full sections and sections in closed academic years', async () => {
    const { schoolId, admin } = await administratorSchool();
    const scope = await factory.academicScope(schoolId);
    const enrolledStudentId = await factory.student(schoolId);
    await factory.enrollment(enrolledStudentId, scope);
    await pool.query('UPDATE sections SET capacity = 1 WHERE id = $1', [
      scope.sectionId,
    ]);
    const candidate = await harness.schoolStudents.createStudent(
      {
        schoolId,
        firstName: 'Capacity',
        lastName: 'Candidate',
      },
      admin.id,
      null,
    );

    await expect(
      harness.schoolStudents.assignStudentSection(
        candidate.id,
        {
          schoolId,
          sectionId: scope.sectionId,
          activateStudent: true,
        },
        admin.id,
        null,
      ),
    ).rejects.toThrow('configured capacity');

    await pool.query('UPDATE sections SET capacity = 2 WHERE id = $1', [
      scope.sectionId,
    ]);
    await pool.query(
      "UPDATE academic_years SET status = 'CLOSED' WHERE id = $1",
      [scope.academicYearId],
    );

    await expect(
      harness.schoolStudents.assignStudentSection(
        candidate.id,
        {
          schoolId,
          sectionId: scope.sectionId,
          activateStudent: true,
        },
        admin.id,
        null,
      ),
    ).rejects.toThrow('closed academic year');
  });

  it('activates initial placement and preserves transfer history', async () => {
    const { schoolId, admin } = await administratorSchool();
    const scope = await factory.academicScope(schoolId);
    const secondSectionId = randomUUID();
    await pool.query(
      `
      INSERT INTO sections (
        id,
        school_id,
        academic_year_id,
        grade_level_id,
        code,
        name_i18n,
        capacity
      )
      VALUES ($1, $2, $3, $4, 'B', '{"fr":"B","en":"B"}', 30)
      `,
      [secondSectionId, schoolId, scope.academicYearId, scope.gradeLevelId],
    );
    const student = await harness.schoolStudents.createStudent(
      {
        schoolId,
        firstName: 'Academic',
        lastName: 'Placement',
      },
      admin.id,
      null,
    );

    const placed = await harness.schoolStudents.assignStudentSection(
      student.id,
      {
        schoolId,
        sectionId: scope.sectionId,
        activateStudent: true,
      },
      admin.id,
      null,
    );
    expect(placed).toMatchObject({
      studentStatus: 'ACTIVE',
      activated: true,
    });

    await expect(
      harness.schoolStudents.assignStudentSection(
        student.id,
        {
          schoolId,
          sectionId: secondSectionId,
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const transferred = await harness.schoolStudents.assignStudentSection(
      student.id,
      {
        schoolId,
        sectionId: secondSectionId,
        reason: 'Balanced section enrollment.',
      },
      admin.id,
      null,
    );
    expect(transferred).toMatchObject({
      studentStatus: 'ACTIVE',
      activated: false,
      section: { id: secondSectionId },
    });

    const enrollmentResult = await pool.query<{
      section_id: string;
      enrollment_status: string;
      deleted_at: Date | null;
      ended_at: Date | null;
      ended_reason: string | null;
    }>(
      `
      SELECT
        section_id,
        enrollment_status::text,
        deleted_at,
        ended_at,
        ended_reason
      FROM enrollments
      WHERE student_id = $1
      ORDER BY created_at ASC
      `,
      [student.id],
    );
    expect(enrollmentResult.rows).toHaveLength(2);
    expect(enrollmentResult.rows[0]).toMatchObject({
      section_id: scope.sectionId,
      enrollment_status: 'TRANSFERRED',
      deleted_at: null,
      ended_reason: 'Balanced section enrollment.',
    });
    expect(enrollmentResult.rows[0].ended_at).toBeTruthy();
    expect(enrollmentResult.rows[1]).toMatchObject({
      section_id: secondSectionId,
      enrollment_status: 'ACTIVE',
      deleted_at: null,
      ended_at: null,
    });
  });

  it('enforces valid lifecycle transitions and closes graduated enrollment', async () => {
    const { schoolId, admin } = await administratorSchool();
    const scope = await factory.academicScope(schoolId);
    const studentId = await factory.student(schoolId);
    await factory.enrollment(studentId, scope);

    await expect(
      harness.schoolStudents.changeStudentStatus(
        studentId,
        { schoolId, newStatus: 'REGISTERED' },
        admin.id,
        null,
      ),
    ).rejects.toThrow('transition is not allowed');

    await expect(
      harness.schoolStudents.changeStudentStatus(
        studentId,
        { schoolId, newStatus: 'SUSPENDED' },
        admin.id,
        null,
      ),
    ).rejects.toThrow('reason is required');

    await harness.schoolStudents.changeStudentStatus(
      studentId,
      {
        schoolId,
        newStatus: 'SUSPENDED',
        reason: 'Temporary administrative hold.',
      },
      admin.id,
      null,
    );
    await expect(
      harness.schoolStudents.changeStudentStatus(
        studentId,
        { schoolId, newStatus: 'ACTIVE' },
        admin.id,
        null,
      ),
    ).rejects.toThrow('reason is required');
    await harness.schoolStudents.changeStudentStatus(
      studentId,
      {
        schoolId,
        newStatus: 'ACTIVE',
        reason: 'Administrative hold resolved.',
      },
      admin.id,
      null,
    );
    await harness.schoolStudents.changeStudentStatus(
      studentId,
      {
        schoolId,
        newStatus: 'GRADUATED',
        reason: 'Academic program completed.',
      },
      admin.id,
      null,
    );

    const result = await pool.query<{
      student_status: string;
      enrollment_status: string;
      ended_reason: string | null;
      ended_at: Date | null;
    }>(
      `
      SELECT
        student.status::text AS student_status,
        enrollment.enrollment_status::text AS enrollment_status,
        enrollment.ended_reason,
        enrollment.ended_at
      FROM students student
      JOIN enrollments enrollment
        ON enrollment.student_id = student.id
      WHERE student.id = $1
      `,
      [studentId],
    );
    expect(result.rows[0]).toMatchObject({
      student_status: 'GRADUATED',
      enrollment_status: 'COMPLETED',
      ended_reason: 'Academic program completed.',
    });
    expect(result.rows[0].ended_at).toBeTruthy();
  });
});
