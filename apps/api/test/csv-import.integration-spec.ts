import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BulkCleanupService } from '../src/school-students/bulk-cleanup.service';
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

  it('reimports a deleted student code without erasing the previous identity or history', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const input = {
      schoolId,
      rows: [
        {
          rowNumber: 2,
          firstName: 'Original',
          lastName: 'Student',
          studentCode: 'LOAD-0001',
        },
      ],
    };
    await harness.schoolStudents.importStudents(input, admin.id, null);
    const original = (
      await pool.query<{ id: string }>(
        'SELECT id FROM students WHERE school_id=$1',
        [schoolId],
      )
    ).rows[0];
    const cleanup = new BulkCleanupService(
      harness.db,
      harness.schoolStudents,
      harness.activity,
    );
    await cleanup.commit(
      {
        schoolId,
        kind: 'students',
        ids: [original.id],
        confirmation: 'DELETE',
        reason: 'Replace incorrect test import',
      },
      admin.id,
      null,
    );
    // Reproduce an existing installation with the old constraint and a deleted
    // record, then apply the real upgrade migration without modifying that row.
    await pool.query(`DROP INDEX uq_students_school_student_number_live;
      ALTER TABLE students ADD CONSTRAINT uq_student_number_per_school UNIQUE(school_id,student_number)`);
    const migration = await readFile(
      resolve(
        __dirname,
        '../../../infra/db/migrations/081_student_number_soft_delete_uniqueness.sql',
      ),
      'utf8',
    );
    await pool.query(migration);
    const corrected = {
      ...input,
      rows: [{ ...input.rows[0], firstName: 'Corrected' }],
    };
    expect(
      (
        await harness.schoolStudents.previewStudentImport(
          corrected,
          admin.id,
          null,
        )
      ).readyForImport,
    ).toBe(true);
    await expect(
      harness.schoolStudents.importStudents(corrected, admin.id, null),
    ).resolves.toEqual({ imported: true, importedCount: 1 });
    const records = await pool.query<{
      id: string;
      first_name: string;
      deleted_at: Date | null;
    }>(
      'SELECT id,first_name,deleted_at FROM students WHERE school_id=$1 ORDER BY created_at,id',
      [schoolId],
    );
    expect(records.rows).toHaveLength(2);
    expect(records.rows.find((r) => r.id === original.id)).toMatchObject({
      first_name: 'Original',
    });
    expect(
      records.rows.find((r) => r.id === original.id)?.deleted_at,
    ).toBeInstanceOf(Date);
    const live = records.rows.find((r) => !r.deleted_at)!;
    expect(live.first_name).toBe('Corrected');
    expect(live.id).not.toBe(original.id);
    expect(
      (
        await pool.query(
          'SELECT id FROM student_status_history WHERE student_id=$1',
          [original.id],
        )
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await harness.schoolStudents.previewStudentImport(
          corrected,
          admin.id,
          null,
        )
      ).readyForImport,
    ).toBe(false);
    // An operator cannot restore both identities under the reused live code.
    await expect(
      pool.query('UPDATE students SET deleted_at=NULL WHERE id=$1', [
        original.id,
      ]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects a legacy student number in preview even if its public code differs', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const id = await factory.student(schoolId);
    await pool.query(
      "UPDATE students SET student_number='LEGACY-NUMBER',student_code='PUBLIC-CODE' WHERE id=$1",
      [id],
    );
    const preview = await harness.schoolStudents.previewStudentImport(
      {
        schoolId,
        rows: [
          {
            rowNumber: 2,
            firstName: 'New',
            lastName: 'Student',
            studentCode: 'LEGACY-NUMBER',
          },
        ],
      },
      admin.id,
      null,
    );
    expect(preview.readyForImport).toBe(false);
    expect(preview.rows[0].errors).toContainEqual(
      expect.objectContaining({ code: 'STUDENT_CODE_ALREADY_EXISTS' }),
    );
    await expect(
      pool.query(
        "INSERT INTO students(school_id,student_number,student_code,first_name,last_name) VALUES($1,'LEGACY-NUMBER','ANOTHER-CODE','Another','Student')",
        [schoolId],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('keeps concurrent imports of the same live code unique', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');
    const input = {
      schoolId,
      rows: [
        {
          rowNumber: 2,
          firstName: 'Concurrent',
          lastName: 'Student',
          studentCode: 'LOAD-RACE',
        },
      ],
    };
    const results = await Promise.allSettled([
      harness.schoolStudents.importStudents(input, admin.id, null),
      harness.schoolStudents.importStudents(input, admin.id, null),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (
        await pool.query(
          "SELECT id FROM students WHERE school_id=$1 AND student_number='LOAD-RACE' AND deleted_at IS NULL",
          [schoolId],
        )
      ).rowCount,
    ).toBe(1);
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
