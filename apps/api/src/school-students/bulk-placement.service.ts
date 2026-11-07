import { BadRequestException, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { SchoolStudentsService } from './school-students.service';
import { BulkPlacementDto } from './dto/bulk-placement.dto';

@Injectable()
export class BulkPlacementService {
  constructor(
    private readonly db: DbService,
    private readonly students: SchoolStudentsService,
    private readonly activity: PlatformActivityService,
  ) {}
  private authorize(
    dto: BulkPlacementDto,
    actor: string,
    role: 'SUPER_ADMIN' | null,
  ) {
    return this.students.assertUserCanAccessStudents(
      actor,
      dto.schoolId,
      role,
      ['SCHOOL_ADMIN'],
    );
  }
  private async inspect(client: PoolClient, dto: BulkPlacementDto) {
    // Same lock order as individual placement: students first, then destination.
    const records = (
      await client.query<{
        id: string;
        name: string;
        code: string;
        status: string;
      }>(
        `SELECT id,CONCAT_WS(' ',first_name,last_name) AS name,COALESCE(student_code,student_number) AS code,status::text
       FROM students WHERE school_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE`,
        [dto.schoolId, dto.studentIds],
      )
    ).rows;
    const section = (
      await client.query<{
        id: string;
        code: string;
        name_i18n: Record<string, string> | null;
        academic_year_id: string;
        year_status: string;
        year_name: Record<string, string> | null;
        capacity: number | null;
      }>(
        `SELECT se.id,se.code,se.name_i18n,se.academic_year_id,ay.status::text AS year_status,ay.name_i18n AS year_name,se.capacity
       FROM sections se JOIN academic_years ay ON ay.id=se.academic_year_id AND ay.school_id=se.school_id AND ay.deleted_at IS NULL
       JOIN grade_levels gl ON gl.id=se.grade_level_id AND gl.school_id=se.school_id AND gl.deleted_at IS NULL
       WHERE se.id=$1 AND se.school_id=$2 AND se.deleted_at IS NULL FOR UPDATE OF se FOR SHARE OF ay,gl`,
        [dto.sectionId, dto.schoolId],
      )
    ).rows[0];
    const errors: string[] = [];
    if (!section) errors.push('SECTION_UNAVAILABLE');
    if (section && section.academic_year_id !== dto.academicYearId)
      errors.push('YEAR_MISMATCH');
    if (section?.year_status === 'CLOSED') errors.push('YEAR_CLOSED');
    const assigned = new Set(
      (
        await client.query<{ student_id: string }>(
          `SELECT student_id FROM enrollments WHERE student_id=ANY($1::uuid[]) AND enrollment_status='ACTIVE' AND deleted_at IS NULL`,
          [dto.studentIds],
        )
      ).rows.map((r) => r.student_id),
    );
    const rows = dto.studentIds.map((id) => {
      const student = records.find((r) => r.id === id);
      const reasons: string[] = [];
      if (!student) reasons.push('STUDENT_UNAVAILABLE');
      if (
        student &&
        !['PRE_REGISTERED', 'REGISTERED', 'ACTIVE'].includes(student.status)
      )
        reasons.push('STATUS_BLOCKED');
      if (assigned.has(id)) reasons.push('ALREADY_ASSIGNED');
      return {
        id,
        name: student?.name ?? '',
        code: student?.code ?? '',
        eligible: reasons.length === 0,
        reasons,
      };
    });
    const occupied = section
      ? Number(
          (
            await client.query<{ count: string }>(
              `SELECT COUNT(*)::text AS count FROM enrollments WHERE section_id=$1 AND enrollment_status='ACTIVE' AND deleted_at IS NULL`,
              [section.id],
            )
          ).rows[0].count,
        )
      : 0;
    const availableSeats =
      section?.capacity == null
        ? null
        : Math.max(0, section.capacity - occupied);
    if (availableSeats !== null && dto.studentIds.length > availableSeats)
      errors.push('CAPACITY_EXCEEDED');
    return {
      rows,
      errors,
      ready: errors.length === 0 && rows.every((r) => r.eligible),
      selectedCount: rows.length,
      section: section
        ? {
            id: section.id,
            code: section.code,
            nameI18n: section.name_i18n,
            academicYearId: section.academic_year_id,
            academicYearNameI18n: section.year_name,
            capacity: section.capacity,
            occupied,
            availableSeats,
          }
        : null,
    };
  }
  async preview(
    dto: BulkPlacementDto,
    actor: string,
    role: 'SUPER_ADMIN' | null,
  ) {
    await this.authorize(dto, actor, role);
    return this.db.withTransaction((client) => this.inspect(client, dto));
  }
  async commit(
    dto: BulkPlacementDto,
    actor: string,
    role: 'SUPER_ADMIN' | null,
  ) {
    await this.authorize(dto, actor, role);
    if (dto.confirmed !== true)
      throw new BadRequestException(
        'Explicit placement confirmation is required.',
      );
    return this.db.withTransaction(async (client) => {
      const preview = await this.inspect(client, dto);
      if (!preview.ready)
        throw new BadRequestException({
          message: 'BULK_PLACEMENT_BLOCKED',
          preview,
        });
      let activatedCount = 0;
      for (const id of [...dto.studentIds].sort()) {
        const result = await this.students.assignStudentSectionTx(
          client,
          id,
          {
            schoolId: dto.schoolId,
            sectionId: dto.sectionId,
            activateStudent: dto.activateStudent ?? false,
            reason: dto.reason?.trim() || 'Bulk initial academic placement.',
          },
          actor,
          role,
          true,
        );
        if ('activated' in result && result.activated) activatedCount++;
      }
      await this.activity.recordTx(client, {
        eventType: 'STUDENTS_BULK_SECTION_ASSIGNED',
        actorType: role === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId: actor,
        schoolId: dto.schoolId,
        summary: 'Unassigned students placed in an academic section.',
        payload: {
          studentIds: dto.studentIds,
          sectionId: dto.sectionId,
          academicYearId: dto.academicYearId,
          activatedCount,
        },
      });
      return {
        assignedCount: dto.studentIds.length,
        activatedCount,
        sectionId: dto.sectionId,
        academicYearId: dto.academicYearId,
      };
    });
  }
}
