import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import { GuardianImportService } from '../src/school-students/guardian-import.service';
import { GuardianImportDto } from '../src/school-students/dto/guardian-import.dto';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('guardian CSV import', () => {
  let pool: Pool;
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let factory: IntegrationFactory;
  let service: GuardianImportService;
  let schoolId: string, actor: string, studentCode: string;
  const row = (extra = {}) => ({
    rowNumber: 2,
    guardianReference: 'RESP-001',
    firstName: 'Marie',
    lastName: 'Joseph',
    email: 'marie@example.test',
    ...extra,
  });
  const input = (rows = [row()]): GuardianImportDto => ({ schoolId, rows });
  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    factory = new IntegrationFactory(
      pool,
      harness.passwords,
      harness.sessionTokens,
    );
    service = new GuardianImportService(
      harness.db,
      harness.schoolStudents,
      harness.activity,
    );
  });
  beforeEach(async () => {
    await resetIntegrationDatabase(pool);
    schoolId = await factory.school();
    actor = (await factory.user()).id;
    await factory.membership(schoolId, actor, 'SCHOOL_ADMIN');
    const student = await factory.student(schoolId);
    studentCode = (
      await pool.query<{ student_number: string }>(
        'SELECT COALESCE(student_code,student_number) AS student_number FROM students WHERE id=$1',
        [student],
      )
    ).rows[0].student_number;
  });
  afterAll(async () => {
    await harness.close();
    await pool.end();
  });

  it('previews without writes, creates a standalone record, and never creates a login', async () => {
    expect((await service.preview(input(), actor, null)).readyForImport).toBe(
      true,
    );
    expect((await pool.query('SELECT id FROM guardians')).rowCount).toBe(0);
    expect(await service.commit(input(), actor, null)).toMatchObject({
      created: 1,
      linked: 0,
    });
    expect((await pool.query('SELECT user_id FROM guardians')).rows).toEqual([
      { user_id: null },
    ]);
    expect((await pool.query('SELECT id FROM user_invitations')).rowCount).toBe(
      0,
    );
  });

  it('shares a guardian across siblings and is idempotent, including concurrent retries', async () => {
    const sibling = await factory.student(schoolId);
    const code = (
      await pool.query<{ student_number: string }>(
        'SELECT COALESCE(student_code,student_number) AS student_number FROM students WHERE id=$1',
        [sibling],
      )
    ).rows[0].student_number;
    const dto = input([
      row({ studentCode, isPrimary: true }),
      row({ rowNumber: 3, studentCode: code, isPrimary: true }),
    ]);
    const results = await Promise.all([
      service.commit(dto, actor, null),
      service.commit(dto, actor, null),
    ]);
    expect(results.map((r) => r.created).sort()).toEqual([0, 1]);
    expect((await pool.query('SELECT id FROM guardians')).rowCount).toBe(1);
    expect(
      (await pool.query('SELECT id FROM student_guardians')).rowCount,
    ).toBe(2);
  });

  it('rejects cross-school students and unauthorized actors', async () => {
    const other = await factory.school();
    const student = await factory.student(other);
    await pool.query(
      "UPDATE students SET student_code='OTHER-ONLY' WHERE id=$1",
      [student],
    );
    const code = (
      await pool.query<{ student_number: string }>(
        'SELECT COALESCE(student_code,student_number) AS student_number FROM students WHERE id=$1',
        [student],
      )
    ).rows[0].student_number;
    const preview = await service.preview(
      input([row({ studentCode: code })]),
      actor,
      null,
    );
    expect(preview.rows[0].errors).toContain('STUDENT_NOT_FOUND');
    await expect(
      service.preview({ ...input(), schoolId: other }, actor, null),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const teacher = await factory.user();
    await factory.membership(schoolId, teacher.id, 'TEACHER');
    await expect(
      service.commit(input(), teacher.id, null),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects conflicting references, duplicate contacts and duplicate links atomically', async () => {
    for (const rows of [
      [row(), row({ rowNumber: 3, lastName: 'Different', studentCode })],
      [row(), row({ rowNumber: 3, guardianReference: 'RESP-002' })],
      [row({ studentCode }), row({ rowNumber: 3, studentCode })],
      [
        row(),
        row({ rowNumber: 3, guardianReference: 'RESP-002', email: 'invalid' }),
      ],
    ])
      await expect(
        service.commit(input(rows), actor, null),
      ).rejects.toBeInstanceOf(BadRequestException);
    expect((await pool.query('SELECT id FROM guardians')).rowCount).toBe(0);
  });

  it('rechecks changed data after preview and never overwrites existing records', async () => {
    const dto = input([row({ studentCode })]);
    await service.commit(dto, actor, null);
    expect((await service.preview(dto, actor, null)).readyForImport).toBe(true);
    await pool.query("UPDATE guardians SET full_name='Changed Name'");
    await expect(service.commit(dto, actor, null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(
      (await pool.query('SELECT full_name FROM guardians')).rows[0].full_name,
    ).toBe('Changed Name');
  });

  it('rejects legacy contact collisions instead of silently merging by name/email', async () => {
    await factory.guardian(schoolId, { email: 'marie@example.test' });
    const preview = await service.preview(input(), actor, null);
    expect(preview.rows[0].errors).toContain('POSSIBLE_DUPLICATE');
  });

  it('protects existing primary contacts and detects two primaries in one file', async () => {
    const twoPrimaries = input([
      row({ studentCode, isPrimary: true }),
      row({
        rowNumber: 3,
        studentCode,
        isPrimary: true,
        guardianReference: 'RESP-002',
        email: 'other@example.test',
      }),
    ]);
    expect(
      (await service.preview(twoPrimaries, actor, null)).rows[1].errors,
    ).toContain('PRIMARY_CONFLICT');
    await service.commit(
      input([row({ studentCode, isPrimary: true })]),
      actor,
      null,
    );
    const preview = await service.preview(
      input([
        row({
          studentCode,
          isPrimary: true,
          guardianReference: 'RESP-002',
          email: 'other@example.test',
        }),
      ]),
      actor,
      null,
    );
    expect(preview.rows[0].errors).toContain('PRIMARY_CONFLICT');
    expect(
      (
        await pool.query(
          'SELECT id FROM student_guardians WHERE is_primary_contact',
        )
      ).rowCount,
    ).toBe(1);
  });

  it('rolls back all records and links when the audit fails', async () => {
    const audit = jest
      .spyOn(harness.activity, 'recordTx')
      .mockRejectedValueOnce(new Error('test audit failure'));
    try {
      await expect(
        service.commit(input([row({ studentCode })]), actor, null),
      ).rejects.toThrow('test audit failure');
      expect((await pool.query('SELECT id FROM guardians')).rowCount).toBe(0);
      expect(
        (await pool.query('SELECT id FROM student_guardians')).rowCount,
      ).toBe(0);
    } finally {
      audit.mockRestore();
    }
  });

  it('imports 600 distinct guardian records and safely reuses all on retry', async () => {
    const dto = input(
      Array.from({ length: 600 }, (_, i) =>
        row({
          rowNumber: i + 2,
          guardianReference: `RESP-${i}`,
          email: `guardian${i}@example.test`,
        }),
      ),
    );
    expect((await service.preview(dto, actor, null)).readyForImport).toBe(true);
    expect(await service.commit(dto, actor, null)).toMatchObject({
      created: 600,
      linked: 0,
    });
    expect(await service.commit(dto, actor, null)).toMatchObject({
      created: 0,
      reused: 600,
      linked: 0,
    });
  });
});
