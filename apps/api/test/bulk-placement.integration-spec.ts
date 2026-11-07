import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/application';
import { StructuredLogger } from '../src/common/observability/structured-logger';
import { BulkPlacementService } from '../src/school-students/bulk-placement.service';
import { BulkPlacementDto } from '../src/school-students/dto/bulk-placement.dto';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';
import { IntegrationFactory } from './support/integration-factory';
import { createServiceHarness } from './support/service-harness';

describe('bulk academic placement', () => {
  let pool: Pool,
    app: NestExpressApplication,
    harness: Awaited<ReturnType<typeof createServiceHarness>>,
    factory: IntegrationFactory,
    service: BulkPlacementService;
  let schoolId: string,
    actor: string,
    scope: Awaited<ReturnType<IntegrationFactory['academicScope']>>;
  const dto = (
    studentIds: string[],
    activateStudent = true,
  ): BulkPlacementDto => ({
    schoolId,
    sectionId: scope.sectionId,
    academicYearId: scope.academicYearId,
    studentIds,
    activateStudent,
    confirmed: true,
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
    service = new BulkPlacementService(
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
    scope = await factory.academicScope(schoolId);
    await pool.query('UPDATE sections SET capacity=5 WHERE id=$1', [
      scope.sectionId,
    ]);
  });
  afterAll(async () => {
    await app.close();
    await harness.close();
    await pool.end();
  });
  it('previews real capacity without enrollment or activation writes', async () => {
    const input = dto([await student(), await student()]);
    const preview = await service.preview(input, actor, null);
    expect(preview).toMatchObject({
      ready: true,
      selectedCount: 2,
      section: { capacity: 5, occupied: 0, availableSeats: 5 },
    });
    expect((await pool.query('SELECT id FROM enrollments')).rowCount).toBe(0);
    expect(
      (await pool.query("SELECT id FROM students WHERE status='ACTIVE'"))
        .rowCount,
    ).toBe(0);
  });
  it('creates genuine enrollments, optional activation histories and per-student audit records', async () => {
    const ids = [await student(), await student()];
    expect(await service.commit(dto(ids), actor, null)).toMatchObject({
      assignedCount: 2,
      activatedCount: 2,
    });
    expect(
      (
        await pool.query(
          "SELECT id FROM enrollments WHERE section_id=$1 AND academic_year_id=$2 AND grade_level_id=$3 AND enrollment_status='ACTIVE'",
          [scope.sectionId, scope.academicYearId, scope.gradeLevelId],
        )
      ).rowCount,
    ).toBe(2);
    expect(
      (await pool.query("SELECT id FROM students WHERE status='ACTIVE'"))
        .rowCount,
    ).toBe(2);
    expect(
      (
        await pool.query(
          "SELECT id FROM student_status_history WHERE previous_status='REGISTERED' AND new_status='ACTIVE'",
        )
      ).rowCount,
    ).toBe(2);
    expect(
      (
        await pool.query(
          "SELECT id FROM platform_activity_logs WHERE event_type='STUDENT_SECTION_ASSIGNED'",
        )
      ).rowCount,
    ).toBe(2);
    const remaining = await harness.schoolStudents.listStudents({
      schoolId,
      page: 1,
      pageSize: 25,
      enrollmentState: 'UNASSIGNED',
    });
    expect(remaining.pagination.total).toBe(0);
    expect(
      (await service.preview(dto(ids), actor, null)).rows.every((r) =>
        r.reasons.includes('ALREADY_ASSIGNED'),
      ),
    ).toBe(true);
  });
  it('can place registered students without activating them', async () => {
    const id = await student();
    expect(await service.commit(dto([id], false), actor, null)).toMatchObject({
      assignedCount: 1,
      activatedCount: 0,
    });
    expect(
      (
        await pool.query<{ status: string }>(
          'SELECT status::text FROM students WHERE id=$1',
          [id],
        )
      ).rows[0].status,
    ).toBe('REGISTERED');
    expect(
      (await pool.query('SELECT id FROM student_status_history')).rowCount,
    ).toBe(0);
  });
  it('blocks assigned students instead of transferring them, with no partial writes', async () => {
    const assigned = await student(),
      fresh = await student();
    await factory.enrollment(assigned, scope);
    const preview = await service.preview(dto([assigned, fresh]), actor, null);
    expect(preview.rows[0].reasons).toContain('ALREADY_ASSIGNED');
    await expect(
      service.commit(dto([assigned, fresh]), actor, null),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((await pool.query('SELECT id FROM enrollments')).rowCount).toBe(1);
    expect(
      (await pool.query("SELECT id FROM students WHERE status='ACTIVE'"))
        .rowCount,
    ).toBe(0);
  });
  it('rejects insufficient capacity and rechecks occupancy after preview', async () => {
    await pool.query('UPDATE sections SET capacity=1 WHERE id=$1', [
      scope.sectionId,
    ]);
    const one = await student(),
      two = await student();
    expect(
      (await service.preview(dto([one, two]), actor, null)).errors,
    ).toContain('CAPACITY_EXCEEDED');
    expect((await service.preview(dto([one]), actor, null)).ready).toBe(true);
    await factory.enrollment(two, scope);
    await expect(
      service.commit(dto([one]), actor, null),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (
        await pool.query('SELECT id FROM enrollments WHERE student_id=$1', [
          one,
        ])
      ).rowCount,
    ).toBe(0);
  });
  it('rejects closed and mismatched academic years', async () => {
    const id = await student();
    const other = await factory.academicScope(schoolId);
    expect(
      (
        await service.preview(
          { ...dto([id]), academicYearId: other.academicYearId },
          actor,
          null,
        )
      ).errors,
    ).toContain('YEAR_MISMATCH');
    await pool.query("UPDATE academic_years SET status='CLOSED' WHERE id=$1", [
      scope.academicYearId,
    ]);
    expect((await service.preview(dto([id]), actor, null)).errors).toContain(
      'YEAR_CLOSED',
    );
    await expect(service.commit(dto([id]), actor, null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('rejects foreign students, foreign sections and cross-school requests', async () => {
    const other = await factory.school(),
      foreignStudent = await factory.student(other),
      foreignScope = await factory.academicScope(other),
      id = await student();
    expect(
      (await service.preview(dto([foreignStudent]), actor, null)).rows[0]
        .reasons,
    ).toContain('STUDENT_UNAVAILABLE');
    expect(
      (
        await service.preview(
          { ...dto([id]), sectionId: foreignScope.sectionId },
          actor,
          null,
        )
      ).errors,
    ).toContain('SECTION_UNAVAILABLE');
    await expect(
      service.commit(
        { ...dto([foreignStudent]), schoolId: other },
        actor,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects non-admins, ineligible statuses and missing confirmation', async () => {
    const id = await student(),
      teacher = await factory.user();
    await factory.membership(schoolId, teacher.id, 'TEACHER');
    await expect(
      service.preview(dto([id]), teacher.id, null),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.commit({ ...dto([id]), confirmed: false }, actor, null),
    ).rejects.toBeInstanceOf(BadRequestException);
    await pool.query("UPDATE students SET status='SUSPENDED' WHERE id=$1", [
      id,
    ]);
    expect(
      (await service.preview(dto([id]), actor, null)).rows[0].reasons,
    ).toContain('STATUS_BLOCKED');
  });
  it('serializes concurrent batches and individual placement to prevent overfilling', async () => {
    await pool.query('UPDATE sections SET capacity=1 WHERE id=$1', [
      scope.sectionId,
    ]);
    const one = await student(),
      two = await student();
    const results = await Promise.allSettled([
      service.commit(dto([one]), actor, null),
      harness.schoolStudents.assignStudentSection(
        two,
        { schoolId, sectionId: scope.sectionId, activateStudent: true },
        actor,
        null,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await pool.query('SELECT id FROM enrollments')).rowCount).toBe(1);
  });
  it('rolls back the whole batch if the second student audit fails', async () => {
    const ids = [await student(), await student()];
    const mock = jest
      .spyOn(harness.activity, 'recordTx')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('audit unavailable'));
    try {
      await expect(service.commit(dto(ids), actor, null)).rejects.toThrow(
        'audit unavailable',
      );
    } finally {
      mock.mockRestore();
    }
    expect((await pool.query('SELECT id FROM enrollments')).rowCount).toBe(0);
    expect(
      (await pool.query('SELECT id FROM student_status_history')).rowCount,
    ).toBe(0);
    expect(
      (await pool.query("SELECT id FROM students WHERE status='ACTIVE'"))
        .rowCount,
    ).toBe(0);
  });
  it('accepts the maximum 100 students and rejects duplicate, empty and oversized DTO selections', async () => {
    await pool.query('UPDATE sections SET capacity=100 WHERE id=$1', [
      scope.sectionId,
    ]);
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) ids.push(await student());
    expect(await service.commit(dto(ids), actor, null)).toMatchObject({
      assignedCount: 100,
      activatedCount: 100,
    });
    for (const input of [dto([]), dto([ids[0], ids[0]]), dto([...ids, ids[0]])])
      expect(
        (await validate(plainToInstance(BulkPlacementDto, input))).length,
      ).toBeGreaterThan(0);
  });
  it('enforces real HTTP sessions, school scope and confirmation', async () => {
    const id = await student(),
      session = await factory.session(actor);
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    await request(server)
      .post('/school-students/bulk-placement/preview')
      .send(dto([id]))
      .expect(401);
    const preview = await request(server)
      .post('/school-students/bulk-placement/preview')
      .set('Authorization', `Bearer ${session.rawToken}`)
      .send(dto([id]))
      .expect(201);
    expect((preview.body as { ready: boolean }).ready).toBe(true);
    await request(server)
      .post('/school-students/bulk-placement')
      .set('Authorization', `Bearer ${session.rawToken}`)
      .send({ ...dto([id]), confirmed: false })
      .expect(400);
    await request(server)
      .post('/school-students/bulk-placement')
      .set('Authorization', `Bearer ${session.rawToken}`)
      .send(dto([id]))
      .expect(201);
  });
});
