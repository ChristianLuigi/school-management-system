import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { SchoolStudentsService } from './school-students.service';
import { BulkCleanupDto, CleanupCandidatesDto } from './dto/bulk-cleanup.dto';

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
type RecordRow = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  user_id: string | null;
};

@Injectable()
export class BulkCleanupService {
  constructor(
    private readonly db: DbService,
    private readonly students: SchoolStudentsService,
    private readonly activity: PlatformActivityService,
  ) {}

  private authorize(
    schoolId: string,
    actor: string,
    role: 'SUPER_ADMIN' | null,
  ) {
    return this.students.assertUserCanAccessStudents(actor, schoolId, role, [
      'SCHOOL_ADMIN',
    ]);
  }

  async candidates(
    dto: CleanupCandidatesDto,
    actor: string,
    role: 'SUPER_ADMIN' | null,
  ) {
    await this.authorize(dto.schoolId, actor, role);
    const page = dto.page ?? 1;
    const table = dto.kind === 'students' ? 'students' : 'guardians';
    const name =
      dto.kind === 'students'
        ? "CONCAT_WS(' ',first_name,last_name)"
        : 'full_name';
    const code =
      dto.kind === 'students'
        ? 'COALESCE(student_code,student_number)'
        : 'import_reference';
    const result = await this.db.query<{
      id: string;
      name: string;
      code: string | null;
    }>(
      `SELECT id, ${name} AS name, ${code} AS code FROM ${table}
       WHERE school_id=$1 AND deleted_at IS NULL
       AND ($2='' OR STRPOS(LOWER(${name}),LOWER($2))>0 OR STRPOS(LOWER(COALESCE(${code},'')),LOWER($2))>0)
       ORDER BY ${name},id LIMIT 26 OFFSET $3`,
      [dto.schoolId, dto.search?.trim() || '', (page - 1) * 25],
    );
    return {
      rows: result.rows.slice(0, 25),
      page,
      hasNext: result.rows.length > 25,
    };
  }

  private async inspect(client: PoolClient, dto: BulkCleanupDto) {
    // Only these two allowlisted record types can ever be changed by this service.
    const table = dto.kind === 'students' ? 'students' : 'guardians';
    const result = await client.query<RecordRow>(
      dto.kind === 'students'
        ? `SELECT id,CONCAT_WS(' ',first_name,last_name) AS name,COALESCE(student_code,student_number) AS code,status::text AS status,NULL::uuid AS user_id FROM students WHERE school_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE`
        : `SELECT id,full_name AS name,import_reference AS code,'' AS status,user_id FROM guardians WHERE school_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE`,
      [dto.schoolId, dto.ids],
    );
    const blocked = new Map<string, Set<string>>(
      dto.ids.map((id) => [id, new Set<string>()]),
    );
    for (const id of dto.ids)
      if (!result.rows.some((r) => r.id === id))
        blocked.get(id)!.add('NOT_AVAILABLE');
    for (const row of result.rows) {
      if (
        dto.kind === 'students' &&
        !['PRE_REGISTERED', 'REGISTERED'].includes(row.status)
      )
        blocked.get(row.id)!.add('PROTECTED_STATUS');
      if (dto.kind === 'guardians' && row.user_id)
        blocked.get(row.id)!.add('LOGIN_ACCOUNT');
    }
    // Inspect every real FK, including future modules: an unknown dependency
    // fails closed instead of silently permitting deletion of its record owner.
    const dependencies = await client.query<{
      schema_name: string;
      table_name: string;
      column_name: string;
    }>(
      `SELECT ns.nspname AS schema_name,child.relname AS table_name,att.attname AS column_name
       FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid
       JOIN pg_namespace ns ON ns.oid=child.relnamespace
       CROSS JOIN LATERAL unnest(c.conkey,c.confkey) AS keys(child_num,parent_num)
       JOIN pg_attribute att ON att.attrelid=c.conrelid AND att.attnum=keys.child_num
       JOIN pg_attribute parent_att ON parent_att.attrelid=c.confrelid AND parent_att.attnum=keys.parent_num
       WHERE c.contype='f' AND c.confrelid=to_regclass($1) AND parent_att.attname='id'`,
      [`public.${table}`],
    );
    for (const dependency of dependencies.rows) {
      if (
        dependency.schema_name === 'public' &&
        dependency.table_name === 'student_guardians'
      )
        continue;
      if (
        dto.kind === 'students' &&
        dependency.schema_name === 'public' &&
        dependency.table_name === 'student_status_history'
      )
        continue;
      const column = identifier(dependency.column_name);
      const refs = await client.query<{ id: string }>(
        `SELECT DISTINCT ${column} AS id FROM ${identifier(dependency.schema_name)}.${identifier(dependency.table_name)} WHERE ${column}=ANY($1::uuid[])`,
        [dto.ids],
      );
      for (const row of refs.rows)
        blocked.get(row.id)!.add('PROTECTED_HISTORY');
    }
    if (dto.kind === 'students') {
      const history = await client.query<{ student_id: string }>(
        `SELECT student_id FROM student_status_history WHERE student_id=ANY($1::uuid[])
         GROUP BY student_id HAVING COUNT(*)>1 OR BOOL_OR(previous_status IS NOT NULL OR new_status NOT IN ('REGISTERED','PRE_REGISTERED'))`,
        [dto.ids],
      );
      for (const row of history.rows)
        blocked.get(row.student_id)!.add('PROTECTED_HISTORY');
      const linkedAccounts = await client.query<{ student_id: string }>(
        `SELECT DISTINCT sg.student_id FROM student_guardians sg JOIN guardians g ON g.id=sg.guardian_id
         WHERE sg.student_id=ANY($1::uuid[]) AND sg.deleted_at IS NULL
         AND (g.user_id IS NOT NULL OR EXISTS(SELECT 1 FROM guardian_account_links gl WHERE gl.guardian_id=g.id AND gl.deleted_at IS NULL))`,
        [dto.ids],
      );
      // Do not implicitly alter a live parent's scope or sessions through cleanup.
      for (const row of linkedAccounts.rows)
        blocked.get(row.student_id)!.add('LOGIN_ACCOUNT');
    } else {
      const links = await client.query<{ guardian_id: string }>(
        `SELECT DISTINCT guardian_id FROM student_guardians WHERE guardian_id=ANY($1::uuid[]) AND deleted_at IS NULL`,
        [dto.ids],
      );
      for (const row of links.rows)
        blocked.get(row.guardian_id)!.add('STUDENT_LINK');
    }
    const rows = dto.ids.map((id) => {
      const record = result.rows.find((r) => r.id === id);
      const reasons = [...blocked.get(id)!];
      return {
        id,
        name: record?.name ?? '',
        code: record?.code ?? null,
        eligible: reasons.length === 0,
        reasons,
      };
    });
    return {
      rows,
      eligibleCount: rows.filter((r) => r.eligible).length,
      blockedCount: rows.filter((r) => !r.eligible).length,
      ready: rows.every((r) => r.eligible),
    };
  }

  async preview(
    dto: BulkCleanupDto,
    actor: string,
    role: 'SUPER_ADMIN' | null,
  ) {
    await this.authorize(dto.schoolId, actor, role);
    return this.db.withTransaction((client) => this.inspect(client, dto));
  }

  async commit(dto: BulkCleanupDto, actor: string, role: 'SUPER_ADMIN' | null) {
    await this.authorize(dto.schoolId, actor, role);
    const reason = dto.reason?.trim();
    if (dto.confirmation !== 'DELETE' || !reason || reason.length < 10)
      throw new BadRequestException(
        'Explicit confirmation and a reason of at least 10 characters are required.',
      );
    return this.db.withTransaction(async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [`guardian-import:${dto.schoolId}`],
      );
      const preview = await this.inspect(client, dto);
      if (!preview.ready)
        throw new BadRequestException({
          message: 'BULK_CLEANUP_BLOCKED',
          preview,
        });
      const table = dto.kind === 'students' ? 'students' : 'guardians';
      const batchId = randomUUID();
      const links =
        dto.kind === 'students'
          ? (
              await client.query<{ id: string }>(
                `UPDATE student_guardians SET deleted_at=NOW(),updated_at=NOW()
         WHERE school_id=$1 AND student_id=ANY($2::uuid[]) AND deleted_at IS NULL RETURNING id`,
                [dto.schoolId, dto.ids],
              )
            ).rows.map((r) => r.id)
          : [];
      const deleted = await client.query<{ id: string; deleted_at: string }>(
        `UPDATE ${table} SET deleted_at=NOW(),updated_at=NOW() WHERE school_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL RETURNING id,deleted_at::text`,
        [dto.schoolId, dto.ids],
      );
      await this.activity.recordTx(client, {
        eventType: 'SCHOOL_RECORDS_BULK_SOFT_DELETED',
        actorType: role === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId: actor,
        schoolId: dto.schoolId,
        summary: 'Unused school records soft-deleted after dependency checks.',
        payload: {
          batchId,
          kind: dto.kind,
          ids: dto.ids,
          studentGuardianIds: links,
          reason,
          deletedAt: deleted.rows[0]?.deleted_at,
        },
      });
      return { deletedCount: deleted.rowCount, batchId, recoverable: true };
    });
  }
}
