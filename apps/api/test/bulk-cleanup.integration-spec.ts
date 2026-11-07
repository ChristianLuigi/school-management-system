import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Pool } from 'pg';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/application';
import { StructuredLogger } from '../src/common/observability/structured-logger';
import { BulkCleanupService } from '../src/school-students/bulk-cleanup.service';
import { BulkCleanupDto } from '../src/school-students/dto/bulk-cleanup.dto';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('targeted bulk cleanup', () => {
  let app: NestExpressApplication;
  let pool: Pool,
    harness: Awaited<ReturnType<typeof createServiceHarness>>,
    factory: IntegrationFactory,
    service: BulkCleanupService;
  let schoolId: string, actor: string;
  const dto = (
    ids: string[],
    kind: 'students' | 'guardians' = 'students',
  ): BulkCleanupDto => ({
    schoolId,
    kind,
    ids,
    reason: 'Duplicate test import',
    confirmation: 'DELETE',
  });
  async function student() {
    const id = await factory.student(schoolId);
    await pool.query("UPDATE students SET status='REGISTERED' WHERE id=$1", [
      id,
    ]);
    return id;
  }
  beforeAll(async () => {
    pool = createIntegrationPool();
    harness = await createServiceHarness();
    factory = new IntegrationFactory(
      pool,
      harness.passwords,
      harness.sessionTokens,
    );
    service = new BulkCleanupService(
      harness.db,
      harness.schoolStudents,
      harness.activity,
    );
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApplication(app, new StructuredLogger());
    await app.init();
  });
  beforeEach(async () => {
    await resetIntegrationDatabase(pool);
    schoolId = await factory.school();
    actor = (await factory.user()).id;
    await factory.membership(schoolId, actor, 'SCHOOL_ADMIN');
  });
  afterAll(async () => {
    await app.close();
    await harness.close();
    await pool.end();
  });

  it('routes the static cleanup endpoint before student IDs and validates HTTP authorization', async () => {
    const id = await student();
    const session = await factory.session(actor);
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .get('/school-students/cleanup')
      .query({ schoolId, kind: 'students' })
      .expect(401);
    const list = await request(server)
      .get('/school-students/cleanup')
      .query({ schoolId, kind: 'students' })
      .set('Authorization', `Bearer ${session.rawToken}`)
      .expect(200);
    expect((list.body as { rows: { id: string }[] }).rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ id })]),
    );
    await request(server)
      .post('/school-students/cleanup/preview')
      .set('Authorization', `Bearer ${session.rawToken}`)
      .send(dto([id]))
      .expect(201);
    await request(server)
      .post('/school-students/cleanup')
      .set('Authorization', `Bearer ${session.rawToken}`)
      .send({ ...dto([id]), kind: 'users' })
      .expect(400);
  });

  it('previews without deleting and soft-deletes unused records with a recovery audit', async () => {
    const id = await student();
    const input = dto([id]);
    expect((await service.preview(input, actor, null)).ready).toBe(true);
    expect(
      (await pool.query('SELECT deleted_at FROM students WHERE id=$1', [id]))
        .rows[0].deleted_at,
    ).toBeNull();
    expect(await service.commit(input, actor, null)).toMatchObject({
      deletedCount: 1,
      recoverable: true,
    });
    expect(
      (await pool.query('SELECT deleted_at FROM students WHERE id=$1', [id]))
        .rows[0].deleted_at,
    ).not.toBeNull();
    const log = await pool.query<{
      payload: { ids: string[]; deletedAt: string; batchId: string };
    }>(
      "SELECT payload FROM platform_activity_logs WHERE event_type='SCHOOL_RECORDS_BULK_SOFT_DELETED'",
    );
    expect(log.rows[0].payload.ids).toEqual([id]);
    expect(log.rows[0].payload.deletedAt).toBeTruthy();
    await expect(service.commit(input, actor, null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Recovery keeps the exact existing owner identity rather than recreating it.
    await pool.query('UPDATE students SET deleted_at=NULL WHERE id=$1', [id]);
    expect(
      (
        await pool.query(
          'SELECT id FROM students WHERE id=$1 AND deleted_at IS NULL',
          [id],
        )
      ).rows[0].id,
    ).toBe(id);
  });
  it('rejects non-admins, cross-school selection and changed schoolId', async () => {
    const id = await student();
    const other = await factory.school();
    const foreign = await factory.student(other);
    const teacher = await factory.user();
    await factory.membership(schoolId, teacher.id, 'TEACHER');
    await expect(
      service.preview(dto([id]), teacher.id, null),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.commit({ ...dto([foreign]), schoolId: other }, actor, null),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      (await service.preview(dto([id, foreign]), actor, null)).rows[1].reasons,
    ).toContain('NOT_AVAILABLE');
    await expect(
      service.commit(dto([id, foreign]), actor, null),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (await pool.query('SELECT id FROM students WHERE deleted_at IS NOT NULL'))
        .rowCount,
    ).toBe(0);
  });
  it('blocks active students, academic enrollment and finance history including deleted invoices', async () => {
    const active = await factory.student(schoolId);
    const enrolled = await student();
    const billed = await student();
    const scope = await factory.academicScope(schoolId);
    await factory.enrollment(enrolled, scope);
    await pool.query(
      `INSERT INTO invoices(school_id,student_id,academic_year_id,invoice_number,issue_date,due_date,currency_code,deleted_at) VALUES($1,$2,$3,'TEST-INV',CURRENT_DATE,CURRENT_DATE,'HTG',NOW())`,
      [schoolId, billed, scope.academicYearId],
    );
    const preview = await service.preview(
      dto([active, enrolled, billed]),
      actor,
      null,
    );
    expect(preview.rows[0].reasons).toContain('PROTECTED_STATUS');
    expect(preview.rows[1].reasons).toContain('PROTECTED_HISTORY');
    expect(preview.rows[2].reasons).toContain('PROTECTED_HISTORY');
  });
  it('permits initial registration history but protects lifecycle changes', async () => {
    const id = await student();
    await pool.query(
      "INSERT INTO student_status_history(school_id,student_id,new_status) VALUES($1,$2,'REGISTERED')",
      [schoolId, id],
    );
    expect((await service.preview(dto([id]), actor, null)).ready).toBe(true);
    await pool.query(
      "INSERT INTO student_status_history(school_id,student_id,previous_status,new_status) VALUES($1,$2,'ACTIVE','REGISTERED')",
      [schoolId, id],
    );
    expect(
      (await service.preview(dto([id]), actor, null)).rows[0].reasons,
    ).toContain('PROTECTED_HISTORY');
  });
  it('protects shared guardians and only detaches links for deleted students', async () => {
    const first = await student(),
      second = await student(),
      guardian = await factory.guardian(schoolId);
    await factory.studentGuardian(schoolId, first, guardian);
    await factory.studentGuardian(schoolId, second, guardian);
    expect(
      (await service.preview(dto([guardian], 'guardians'), actor, null)).rows[0]
        .reasons,
    ).toContain('STUDENT_LINK');
    await service.commit(dto([first]), actor, null);
    expect(
      (
        await pool.query(
          'SELECT id FROM student_guardians WHERE student_id=$1 AND deleted_at IS NULL',
          [second],
        )
      ).rowCount,
    ).toBe(1);
    expect(
      (await service.preview(dto([guardian], 'guardians'), actor, null)).ready,
    ).toBe(false);
    await service.commit(dto([second]), actor, null);
    expect(
      await service.commit(dto([guardian], 'guardians'), actor, null),
    ).toMatchObject({ deletedCount: 1 });
  });
  it('blocks parents with login access without changing their sessions', async () => {
    const id = await student(),
      parent = await factory.user(),
      guardian = await factory.guardian(schoolId, { userId: parent.id });
    await factory.studentGuardian(schoolId, id, guardian);
    expect(
      (await service.preview(dto([id]), actor, null)).rows[0].reasons,
    ).toContain('LOGIN_ACCOUNT');
    expect(
      (await service.preview(dto([guardian], 'guardians'), actor, null)).rows[0]
        .reasons,
    ).toContain('LOGIN_ACCOUNT');
  });
  it('requires explicit confirmation and rechecks a changed status after preview', async () => {
    const id = await student();
    const input = dto([id]);
    await expect(
      service.commit({ ...input, confirmation: undefined }, actor, null),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.commit({ ...input, reason: 'short' }, actor, null),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await service.preview(input, actor, null)).ready).toBe(true);
    await pool.query("UPDATE students SET status='ACTIVE' WHERE id=$1", [id]);
    await expect(service.commit(input, actor, null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('rolls back deletion and detached links if the audit fails', async () => {
    const id = await student(),
      guardian = await factory.guardian(schoolId);
    await factory.studentGuardian(schoolId, id, guardian);
    const mock = jest
      .spyOn(harness.activity, 'recordTx')
      .mockRejectedValueOnce(new Error('audit unavailable'));
    try {
      await expect(service.commit(dto([id]), actor, null)).rejects.toThrow(
        'audit unavailable',
      );
    } finally {
      mock.mockRestore();
    }
    expect(
      (await pool.query('SELECT id FROM students WHERE deleted_at IS NULL'))
        .rowCount,
    ).toBe(1);
    expect(
      (
        await pool.query(
          'SELECT id FROM student_guardians WHERE deleted_at IS NULL',
        )
      ).rowCount,
    ).toBe(1);
  });
  it('serializes duplicate concurrent deletion requests', async () => {
    const id = await student();
    const outcomes = await Promise.allSettled([
      service.commit(dto([id]), actor, null),
      service.commit(dto([id]), actor, null),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (
        await pool.query(
          "SELECT id FROM platform_activity_logs WHERE event_type='SCHOOL_RECORDS_BULK_SOFT_DELETED'",
        )
      ).rowCount,
    ).toBe(1);
  });
  it('rejects unsupported profiles, empty, duplicate and oversized selections at the DTO boundary', async () => {
    const id = await student();
    for (const value of [
      { ...dto([id]), kind: 'users' },
      dto([]),
      dto([id, id]),
      dto(Array.from({ length: 101 }, () => id)),
    ])
      expect(
        (await validate(plainToInstance(BulkCleanupDto, value))).length,
      ).toBeGreaterThan(0);
  });

  it('blocks a newly introduced FK dependency without a hardcoded module allowlist', async () => {
    const id = await student();
    await pool.query(
      'CREATE TABLE cleanup_test_dependency (student_id UUID REFERENCES students(id))',
    );
    try {
      await pool.query(
        'INSERT INTO cleanup_test_dependency(student_id) VALUES($1)',
        [id],
      );
      expect(
        (await service.preview(dto([id]), actor, null)).rows[0].reasons,
      ).toContain('PROTECTED_HISTORY');
    } finally {
      await pool.query('DROP TABLE cleanup_test_dependency');
    }
  });

  it('paginates candidates and applies school-scoped search', async () => {
    await pool.query(
      "INSERT INTO guardians(school_id,full_name) SELECT $1,'Cleanup guardian '||n FROM generate_series(1,26) n",
      [schoolId],
    );
    const first = await service.candidates(
      { schoolId, kind: 'guardians', page: 1 },
      actor,
      null,
    );
    const second = await service.candidates(
      { schoolId, kind: 'guardians', page: 2 },
      actor,
      null,
    );
    expect(first.rows).toHaveLength(25);
    expect(first.hasNext).toBe(true);
    expect(second.rows).toHaveLength(1);
    expect(second.hasNext).toBe(false);
    expect(
      (
        await service.candidates(
          { schoolId, kind: 'guardians', search: 'Cleanup guardian 26' },
          actor,
          null,
        )
      ).rows,
    ).toHaveLength(1);
  });
});
