import { BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('student guardian and document hardening integration', () => {
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

  it('keeps one reachable primary guardian', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    const studentId = await factory.student(schoolId);
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');

    const firstGuardian = await harness.schoolStudents.addStudentGuardian(
      studentId,
      {
        schoolId,
        fullName: 'First Guardian',
        phonePrimary: '+509 3100 0001',
      },
      admin.id,
      null,
    );
    expect(firstGuardian.isPrimaryContact).toBe(true);

    await expect(
      harness.schoolStudents.addStudentGuardian(
        studentId,
        {
          schoolId,
          fullName: 'Unreachable Emergency Contact',
          isEmergencyContact: true,
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const secondGuardian = await harness.schoolStudents.addStudentGuardian(
      studentId,
      {
        schoolId,
        fullName: 'Second Guardian',
        email: 'SECOND.GUARDIAN@example.test',
        isPrimaryContact: true,
      },
      admin.id,
      null,
    );
    expect(secondGuardian).toMatchObject({
      isPrimaryContact: true,
      email: 'second.guardian@example.test',
    });

    const primaryResult = await pool.query<{
      id: string;
      is_primary_contact: boolean;
    }>(
      `
      SELECT id, is_primary_contact
      FROM student_guardians
      WHERE student_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at
      `,
      [studentId],
    );
    expect(primaryResult.rows.filter((row) => row.is_primary_contact)).toEqual([
      expect.objectContaining({ id: secondGuardian.studentGuardianId }),
    ]);

    await expect(
      harness.schoolStudents.updateStudentGuardian(
        studentId,
        secondGuardian.studentGuardianId,
        { schoolId, isPrimaryContact: false },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires evidence before verification and records review metadata', async () => {
    const schoolId = await factory.school();
    const admin = await factory.user();
    const studentId = await factory.student(schoolId);
    await factory.membership(schoolId, admin.id, 'SCHOOL_ADMIN');

    await expect(
      harness.schoolStudents.addStudentDocument(
        studentId,
        {
          schoolId,
          documentType: 'BIRTH_CERTIFICATE',
          documentStatus: 'VERIFIED',
        },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const pendingDocument = await harness.schoolStudents.addStudentDocument(
      studentId,
      {
        schoolId,
        documentType: 'BIRTH_CERTIFICATE',
        fileName: 'birth-certificate.pdf',
        fileUrl: '/api/uploads/student-files/birth-certificate.pdf',
      },
      admin.id,
      null,
    );
    expect(pendingDocument).toMatchObject({
      documentStatus: 'PENDING',
      receivedAt: new Date().toISOString().slice(0, 10),
      verifiedAt: null,
    });

    const verifiedDocument = await harness.schoolStudents.updateStudentDocument(
      studentId,
      pendingDocument.id,
      { schoolId, documentStatus: 'VERIFIED' },
      admin.id,
      null,
    );
    expect(verifiedDocument.documentStatus).toBe('VERIFIED');
    expect(verifiedDocument.verifiedAt).toBeTruthy();

    await expect(
      harness.schoolStudents.updateStudentDocument(
        studentId,
        pendingDocument.id,
        { schoolId, receivedAt: '2999-01-01' },
        admin.id,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
