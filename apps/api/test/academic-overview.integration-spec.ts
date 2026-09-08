import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('academic overview integration', () => {
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

  it('shows school readiness to administrators and only assigned scope to teachers', async () => {
    const schoolId = await factory.school();
    const otherSchoolId = await factory.school();
    const admin = await factory.user();
    const firstTeacher = await factory.user();
    const secondTeacher = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    await factory.membership(schoolId, firstTeacher.id, 'TEACHER');
    await factory.membership(schoolId, secondTeacher.id, 'TEACHER');
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
        name_i18n
      )
      VALUES ($1, $2, $3, $4, 'B', '{"fr":"B","en":"B"}')
      `,
      [secondSectionId, schoolId, scope.academicYearId, scope.gradeLevelId],
    );
    await pool.query('UPDATE sections SET capacity = 2 WHERE id = $1', [
      scope.sectionId,
    ]);

    await factory.teacherAssignment(schoolId, firstTeacher.id, scope, admin.id);
    await factory.teacherAssignment(
      schoolId,
      secondTeacher.id,
      {
        academicYearId: scope.academicYearId,
        sectionId: secondSectionId,
        subjectId: scope.subjectId,
      },
      admin.id,
    );

    const firstStudentId = await factory.student(schoolId);
    const secondStudentId = await factory.student(schoolId);
    await factory.student(schoolId);
    await factory.enrollment(firstStudentId, scope);
    await factory.enrollment(secondStudentId, scope);

    const administratorOverview = await harness.academic.getAcademicOverview(
      schoolId,
      admin.id,
      null,
    );
    expect(administratorOverview).toMatchObject({
      viewMode: 'ADMINISTRATOR',
      metrics: {
        sectionCount: 2,
        studentCount: 2,
        assignmentCount: 2,
        subjectCoveragePercent: 100,
      },
      readiness: {
        sectionsAtCapacity: 1,
        sectionsWithoutCapacity: 1,
        unassignedSubjectSlots: 0,
        studentsWithoutPlacement: 1,
      },
    });

    const teacherOverview = await harness.academic.getAcademicOverview(
      schoolId,
      firstTeacher.id,
      null,
    );
    expect(teacherOverview).toMatchObject({
      viewMode: 'TEACHER',
      metrics: {
        sectionCount: 1,
        studentCount: 2,
        assignmentCount: 1,
        subjectCoveragePercent: 100,
      },
    });
    const teacherSections = teacherOverview.sections as Array<{ id: string }>;
    const teacherAssignments = teacherOverview.assignments as Array<{
      sectionId: string;
    }>;
    expect(teacherSections.map((section) => section.id)).toEqual([
      scope.sectionId,
    ]);
    expect(
      teacherAssignments.map((assignment) => assignment.sectionId),
    ).toEqual([scope.sectionId]);

    const administratorOptions = await harness.academic.findSectionOptions(
      schoolId,
      admin.id,
      null,
    );
    const teacherOptions = await harness.academic.findSectionOptions(
      schoolId,
      firstTeacher.id,
      null,
    );
    expect(administratorOptions.map((section) => section.id)).toEqual(
      expect.arrayContaining([scope.sectionId, secondSectionId]),
    );
    expect(teacherOptions.map((section) => section.id)).toEqual([
      scope.sectionId,
    ]);

    const unassignedSubjectId = randomUUID();
    await pool.query(
      `
      INSERT INTO school_subjects (id, school_id, code, name_i18n)
      VALUES ($1, $2, 'SCIENCE', '{"fr":"Sciences","en":"Science"}')
      `,
      [unassignedSubjectId, schoolId],
    );
    await pool.query(
      `
      INSERT INTO grade_level_subjects (
        school_id,
        grade_level_id,
        subject_id,
        display_order
      )
      VALUES ($1, $2, $3, 2)
      `,
      [schoolId, scope.gradeLevelId, unassignedSubjectId],
    );

    const administratorSubjects = await harness.academic.listSectionSubjects(
      { schoolId, sectionId: scope.sectionId },
      admin.id,
      null,
    );
    const teacherSubjects = await harness.academic.listSectionSubjects(
      { schoolId, sectionId: scope.sectionId },
      firstTeacher.id,
      null,
    );
    expect(administratorSubjects).toHaveLength(2);
    expect(teacherSubjects.map((subject) => subject.subjectId)).toEqual([
      scope.subjectId,
    ]);
    await expect(
      harness.academic.listSectionSubjects(
        { schoolId, sectionId: secondSectionId },
        firstTeacher.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      harness.academic.getAcademicOverview(
        otherSchoolId,
        firstTeacher.id,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
