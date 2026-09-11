import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('CSV import integration', () => {
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

  it('imports staff drafts atomically after a valid preview', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const input = {
      schoolId,
      rows: [
        {
          rowNumber: 2,
          firstName: 'Marie',
          lastName: 'Laurent',
          email: 'marie.import@example.test',
          staffCategory: 'TEACHING',
          employmentType: 'FULL_TIME',
          jobTitle: 'Teacher',
        },
        {
          rowNumber: 3,
          firstName: 'Jean',
          lastName: 'Pierre',
          staffCode: 'CSV-STAFF-002',
          staffCategory: 'SUPPORT',
          employmentType: 'PART_TIME',
        },
      ],
    };

    const preview = await harness.staffManagement.previewStaffImport(
      input,
      admin.id,
    );
    expect(preview).toMatchObject({
      readyForImport: true,
      summary: { totalRows: 2, validRows: 2, invalidRows: 0 },
    });

    const imported = await harness.staffManagement.importStaff(input, admin.id);
    expect(imported).toMatchObject({ imported: true, importedCount: 2 });
    const records = await pool.query<{
      employment_status: string;
      user_id: string | null;
    }>(
      `
      SELECT employment_status, user_id
      FROM school_staff_accounts
      WHERE school_id = $1
        AND user_id IS NULL
        AND deleted_at IS NULL
      `,
      [schoolId],
    );
    expect(records.rows).toHaveLength(2);
    expect(records.rows.every((row) => row.employment_status === 'DRAFT')).toBe(
      true,
    );

    await expect(
      harness.staffManagement.importStaff(input, admin.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates and atomically imports 600 students without cross-school scope leaks', async () => {
    const schoolId = await factory.school();
    const otherSchoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const otherScope = await factory.academicScope(otherSchoolId);
    const rows = Array.from({ length: 600 }, (_, index) => ({
      rowNumber: index + 2,
      firstName: `Student${String(index + 1).padStart(3, '0')}`,
      lastName: `Load${String((index % 75) + 1).padStart(2, '0')}`,
      gender: index % 2 === 0 ? 'FEMALE' : 'MALE',
      dateOfBirth: `${2010 + (index % 7)}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
      placeOfBirth: index % 3 === 0 ? 'Pétion-Ville' : 'Port-au-Prince',
    }));
    const input = { schoolId, rows };

    const preview = await harness.schoolStudents.previewStudentImport(
      input,
      admin.id,
      null,
    );
    expect(preview).toMatchObject({
      importMode: 'ATOMIC',
      readyForImport: true,
      summary: {
        totalRows: 600,
        validRows: 600,
        invalidRows: 0,
        warningRows: 600,
      },
    });

    const imported = await harness.schoolStudents.importStudents(
      input,
      admin.id,
      null,
    );
    expect(imported).toEqual({ imported: true, importedCount: 600 });
    const totals = await pool.query<{
      students: string;
      histories: string;
    }>(
      `
      SELECT
        (SELECT COUNT(*) FROM students WHERE school_id = $1)::text AS students,
        (
          SELECT COUNT(*)
          FROM student_status_history
          WHERE school_id = $1
        )::text AS histories
      `,
      [schoolId],
    );
    expect(totals.rows[0]).toEqual({ students: '600', histories: '600' });

    const crossSchool = {
      schoolId,
      rows: [
        {
          rowNumber: 2,
          firstName: 'Cross',
          lastName: 'School',
          sectionId: otherScope.sectionId,
        },
      ],
    };
    const crossPreview = await harness.schoolStudents.previewStudentImport(
      crossSchool,
      admin.id,
      null,
    );
    expect(crossPreview.readyForImport).toBe(false);
    expect(crossPreview.rows[0].errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SECTION_NOT_AVAILABLE' }),
      ]),
    );
    await expect(
      harness.schoolStudents.importStudents(crossSchool, admin.id, null),
    ).rejects.toBeInstanceOf(BadRequestException);

    const outsider = await factory.user();
    await expect(
      harness.schoolStudents.previewStudentImport(input, outsider.id, null),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
