import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { GetAttendanceSessionDto } from './dto/get-attendance-session.dto';
import { SubmitAttendanceSessionDto } from './dto/submit-attendance-session.dto';

type AttendanceRosterRow = {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
};

type AttendanceSessionRow = {
  id: string;
  school_id: string;
  section_id: string;
  attendance_date: string;
  slot: 'MORNING' | 'AFTERNOON';
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
  taken_by_user_id: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type AttendanceRecordRow = {
  id: string;
  attendance_session_id: string;
  student_id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note_i18n: Record<string, string> | null;
  parent_notified: boolean;
  parent_notified_at: string | null;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  async assertUserCanAccessAttendance(
    actorUserId: string,
    schoolId: string,
    platformRole: 'SUPER_ADMIN' | null,
    allowedRoles: Array<'SCHOOL_ADMIN' | 'TEACHER'>,
  ) {
    const schoolResult = await this.db.query<{
      id: string;
      management_mode: 'SELF_MANAGED' | 'SUPERADMIN_MANAGED' | 'HYBRID_MANAGED';
    }>(
      `
      SELECT id, management_mode
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );

    const school = schoolResult.rows[0];

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found.`);
    }

    if (
      platformRole === 'SUPER_ADMIN' &&
      school.management_mode !== 'SELF_MANAGED'
    ) {
      return;
    }

    const membershipResult = await this.db.query<{
      role: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';
    }>(
      `
      SELECT smr.role
      FROM school_memberships sm
      JOIN school_membership_roles smr
        ON smr.school_membership_id = sm.id
       AND smr.deleted_at IS NULL
      WHERE sm.user_id = $1
        AND sm.school_id = $2
        AND sm.deleted_at IS NULL
        AND sm.membership_status = 'ACTIVE'
      `,
      [actorUserId, schoolId],
    );

    const userRoles = membershipResult.rows.map((row) => row.role);
    const hasAllowedRole = allowedRoles.some((role) =>
      userRoles.includes(role),
    );

    if (!hasAllowedRole) {
      throw new ForbiddenException(
        'You do not have permission to perform this attendance action.',
      );
    }
  }

  async assertUserCanLockAttendanceSession(
    actorUserId: string,
    attendanceSessionId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const sessionResult = await this.db.query<{
      school_id: string;
    }>(
      `
      SELECT school_id
      FROM attendance_sessions
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [attendanceSessionId],
    );

    const session = sessionResult.rows[0];

    if (!session) {
      throw new NotFoundException(
        `Attendance session ${attendanceSessionId} not found.`,
      );
    }

    await this.assertUserCanAccessAttendance(
      actorUserId,
      session.school_id,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return session.school_id;
  }
  async findRoster(sectionId: string): Promise<AttendanceRosterRow[]> {
    const result = await this.db.query<AttendanceRosterRow>(
      `
      SELECT
        s.id AS student_id,
        s.student_number,
        s.first_name,
        s.last_name
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE e.section_id = $1
        AND e.enrollment_status = 'ACTIVE'
        AND e.deleted_at IS NULL
        AND s.deleted_at IS NULL
      ORDER BY s.last_name ASC, s.first_name ASC
      `,
      [sectionId],
    );

    return result.rows;
  }

  async findSessions(
    sectionId: string,
    date: string,
    slot: 'MORNING' | 'AFTERNOON',
  ): Promise<AttendanceSessionRow[]> {
    const result = await this.db.query<AttendanceSessionRow>(
      `
      SELECT
        id,
        school_id,
        section_id,
        attendance_date,
        slot,
        status,
        taken_by_user_id,
        submitted_at,
        created_at,
        updated_at
      FROM attendance_sessions
      WHERE section_id = $1
        AND attendance_date = $2
        AND slot = $3
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      `,
      [sectionId, date, slot],
    );

    return result.rows;
  }

  async findRecords(
    attendanceSessionId: string,
  ): Promise<AttendanceRecordRow[]> {
    const result = await this.db.query<AttendanceRecordRow>(
      `
      SELECT
        ar.id,
        ar.attendance_session_id,
        ar.student_id,
        ar.status,
        ar.note_i18n,
        ar.parent_notified,
        ar.parent_notified_at,
        s.student_number,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        ar.created_at,
        ar.updated_at
      FROM attendance_records ar
      JOIN students s ON s.id = ar.student_id
      WHERE ar.attendance_session_id = $1
        AND ar.deleted_at IS NULL
        AND s.deleted_at IS NULL
      ORDER BY s.last_name ASC, s.first_name ASC
      `,
      [attendanceSessionId],
    );

    return result.rows;
  }

  async submitSession(
    dto: SubmitAttendanceSessionDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const uniqueStudentIds = new Set(
      dto.records.map((record) => record.studentId),
    );

    if (uniqueStudentIds.size !== dto.records.length) {
      throw new BadRequestException(
        'Duplicate student records are not allowed in one attendance submission.',
      );
    }

    await this.assertUserCanAccessAttendance(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    return this.db.withTransaction(async (client) => {
      const sectionResult = await client.query<{
        id: string;
        school_id: string;
      }>(
        `
        SELECT id, school_id
        FROM sections
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.sectionId, dto.schoolId],
      );

      const section = sectionResult.rows[0];

      if (!section) {
        throw new NotFoundException(
          'Section not found or does not belong to this school.',
        );
      }

      const staffResult = await client.query<{ id: string }>(
        `
        SELECT u.id
        FROM users u
        JOIN school_memberships sm ON sm.user_id = u.id
        WHERE u.id = $1
          AND sm.school_id = $2
          AND u.deleted_at IS NULL
          AND sm.deleted_at IS NULL
          AND sm.membership_status = 'ACTIVE'
        LIMIT 1
        `,
        [actorUserId, dto.schoolId],
      );

      if (!staffResult.rows[0]) {
        throw new BadRequestException(
          'The attendance taker is not an active staff member of this school.',
        );
      }

      const rosterResult = await client.query<{ student_id: string }>(
        `
        SELECT st.id AS student_id
        FROM enrollments e
        JOIN students st ON st.id = e.student_id
        WHERE st.school_id = $1
          AND e.section_id = $2
          AND st.id = ANY($3::uuid[])
          AND e.enrollment_status = 'ACTIVE'
          AND e.deleted_at IS NULL
          AND st.deleted_at IS NULL
        `,
        [dto.schoolId, dto.sectionId, Array.from(uniqueStudentIds)],
      );

      const validStudentIds = new Set(
        rosterResult.rows.map((row) => row.student_id),
      );

      const invalidStudentIds = Array.from(uniqueStudentIds).filter(
        (studentId) => !validStudentIds.has(studentId),
      );

      if (invalidStudentIds.length > 0) {
        throw new BadRequestException({
          message: 'Some students do not belong to this section and school.',
          invalidStudentIds,
        });
      }

      const sessionResult = await client.query<{
        id: string;
        school_id: string;
        section_id: string;
        attendance_date: string;
        slot: 'MORNING' | 'AFTERNOON';
        status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
        taken_by_user_id: string;
        submitted_at: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `
        INSERT INTO attendance_sessions (
          school_id,
          section_id,
          attendance_date,
          slot,
          status,
          taken_by_user_id,
          submitted_at
        )
        VALUES ($1, $2, $3, $4, 'SUBMITTED', $5, NOW())
        ON CONFLICT (school_id, section_id, attendance_date, slot)
        WHERE deleted_at IS NULL
        DO UPDATE SET
          taken_by_user_id = EXCLUDED.taken_by_user_id,
          status = CASE
            WHEN attendance_sessions.status = 'LOCKED'
              THEN attendance_sessions.status
            ELSE 'SUBMITTED'::attendance_session_status
          END,
          submitted_at = CASE
            WHEN attendance_sessions.status = 'LOCKED'
              THEN attendance_sessions.submitted_at
            ELSE NOW()
          END,
          updated_at = NOW()
        RETURNING
          id,
          school_id,
          section_id,
          attendance_date,
          slot,
          status,
          taken_by_user_id,
          submitted_at,
          created_at,
          updated_at
        `,
        [
          dto.schoolId,
          dto.sectionId,
          dto.attendanceDate,
          dto.slot,
          actorUserId,
        ],
      );

      const session = sessionResult.rows[0];

      if (!session) {
        throw new BadRequestException('Unable to create attendance session.');
      }

      if (session.status === 'LOCKED') {
        throw new ConflictException(
          'This attendance session is locked and cannot be modified.',
        );
      }

      for (const record of dto.records) {
        const trimmedNote = record.note?.trim() ?? '';
        const noteI18n = trimmedNote
          ? JSON.stringify({ fr: trimmedNote, en: trimmedNote })
          : null;

        await client.query(
          `
          INSERT INTO attendance_records (
            attendance_session_id,
            student_id,
            status,
            note_i18n,
            parent_notified,
            parent_notified_at
          )
          VALUES ($1, $2, $3, $4::jsonb, FALSE, NULL)
          ON CONFLICT (attendance_session_id, student_id)
          WHERE deleted_at IS NULL
          DO UPDATE SET
            status = EXCLUDED.status,
            note_i18n = EXCLUDED.note_i18n,
            parent_notified = FALSE,
            parent_notified_at = NULL,
            updated_at = NOW()
          `,
          [session.id, record.studentId, record.status, noteI18n],
        );
      }

      await client.query(
        `
        DELETE FROM notifications
        WHERE type = 'ATTENDANCE_ALERT'
          AND payload->>'attendance_session_id' = $1::text
        `,
        [session.id],
      );

      await client.query(
        `
        INSERT INTO notifications (
          school_id,
          recipient_user_id,
          type,
          channel,
          title_i18n,
          body_i18n,
          payload,
          status
        )
        SELECT
          sess.school_id,
          u.id,
          'ATTENDANCE_ALERT',
          channels.channel,
          jsonb_build_object(
            'fr', 'Absence enregistrée',
            'en', 'Absence recorded'
          ),
          jsonb_build_object(
            'fr', CONCAT('Une absence a été enregistrée pour ', s.first_name, ' ', s.last_name, ' le ', sess.attendance_date, '.'),
            'en', CONCAT('An absence was recorded for ', s.first_name, ' ', s.last_name, ' on ', sess.attendance_date, '.')
          ),
          jsonb_build_object(
            'attendance_session_id', sess.id,
            'student_id', s.id,
            'attendance_date', sess.attendance_date,
            'slot', sess.slot,
            'status', ar.status
          ),
          'PENDING'
        FROM attendance_records ar
        JOIN attendance_sessions sess ON sess.id = ar.attendance_session_id
        JOIN students s ON s.id = ar.student_id
        JOIN student_guardians sg ON sg.student_id = s.id
        JOIN guardians g ON g.id = sg.guardian_id
        JOIN users u ON u.id = g.user_id
        CROSS JOIN (
          VALUES ('IN_APP'::notification_channel),
                 ('EMAIL'::notification_channel)
        ) AS channels(channel)
        WHERE ar.attendance_session_id = $1
          AND ar.status = 'ABSENT'
          AND ar.deleted_at IS NULL
          AND sess.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND sg.deleted_at IS NULL
          AND g.deleted_at IS NULL
          AND u.deleted_at IS NULL
          AND g.receive_attendance_alerts = TRUE
          AND sg.can_view_academics = TRUE
        `,
        [session.id],
      );

      await client.query(
        `
        UPDATE attendance_records
        SET parent_notified = TRUE,
            parent_notified_at = NOW(),
            updated_at = NOW()
        WHERE attendance_session_id = $1
          AND status = 'ABSENT'
          AND deleted_at IS NULL
        `,
        [session.id],
      );

      await client.query(
        `
        INSERT INTO audit_logs (
          school_id,
          actor_user_id,
          entity_table,
          entity_id,
          action,
          new_values
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          'attendance_sessions',
          $3::uuid,
          'SUBMIT',
          jsonb_build_object(
            'attendance_date', $4::date,
            'slot', $5::text,
            'record_count', $6::int
          )
        )
        `,
        [
          dto.schoolId,
          actorUserId,
          session.id,
          dto.attendanceDate,
          dto.slot,
          dto.records.length,
        ],
      );

      const countsResult = await client.query<{
        status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
        count: string;
      }>(
        `
        SELECT status, COUNT(*)::text AS count
        FROM attendance_records
        WHERE attendance_session_id = $1
          AND deleted_at IS NULL
        GROUP BY status
        `,
        [session.id],
      );

      const counts = {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };

      for (const row of countsResult.rows) {
        if (row.status === 'PRESENT') counts.present = Number(row.count);
        if (row.status === 'ABSENT') counts.absent = Number(row.count);
        if (row.status === 'LATE') counts.late = Number(row.count);
        if (row.status === 'EXCUSED') counts.excused = Number(row.count);
      }

      await this.queueAbsenceNotifications(client, {
        schoolId: dto.schoolId,
        attendanceSessionId: session.id,
        attendanceDate: dto.attendanceDate,
        slot: dto.slot,
        records: dto.records,
      });

      await this.platformActivityService.recordTx(client, {
        eventType: 'ATTENDANCE_SUBMITTED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Attendance submitted for ${dto.attendanceDate} ${dto.slot}.`,
        payload: {
          sectionId: dto.sectionId,
          attendanceSessionId: session.id,
          recordsSubmitted: dto.records.length,
          counts,
        },
      });

      return {
        attendanceSessionId: session.id,
        schoolId: dto.schoolId,
        sectionId: dto.sectionId,
        attendanceDate: dto.attendanceDate,
        slot: dto.slot,
        sessionStatus: session.status,
        counts,
        recordsSubmitted: dto.records.length,
        session,
        summary: {
          total: Object.values(counts).reduce((sum, count) => sum + count, 0),
          present: counts.present,
          absent: counts.absent,
          late: counts.late,
          excused: counts.excused,
        },
      };
    });
  }

  async getAttendanceSession(
    dto: GetAttendanceSessionDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAttendance(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const sectionResult = await this.db.query<{
      id: string;
      code: string;
      name_i18n: Record<string, string> | null;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string> | null;
    }>(
      `
      SELECT
        se.id,
        se.code,
        se.name_i18n,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n
      FROM sections se
      JOIN grade_levels gl
        ON gl.id = se.grade_level_id
       AND gl.deleted_at IS NULL
      WHERE se.id = $1
        AND se.school_id = $2
        AND se.deleted_at IS NULL
      LIMIT 1
      `,
      [dto.sectionId, dto.schoolId],
    );

    const section = sectionResult.rows[0];

    if (!section) {
      throw new NotFoundException('Section not found for this school.');
    }

    const studentsResult = await this.db.query<{
      student_id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
      gender: string | null;
      student_status: string;
    }>(
      `
      SELECT
        st.id AS student_id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.first_name,
        st.last_name,
        st.gender::text AS gender,
        COALESCE(st.status::text, 'ACTIVE') AS student_status
      FROM enrollments en
      JOIN students st
        ON st.id = en.student_id
       AND st.deleted_at IS NULL
      WHERE en.section_id = $1
        AND en.deleted_at IS NULL
        AND en.enrollment_status = 'ACTIVE'
        AND st.school_id = $2
        AND COALESCE(st.status::text, 'ACTIVE') IN ('ACTIVE', 'REGISTERED')
      ORDER BY st.last_name ASC, st.first_name ASC
      `,
      [dto.sectionId, dto.schoolId],
    );

    const sessionResult = await this.db.query<{
      id: string;
      attendance_date: string;
      slot: string;
      status: string | null;
      submitted_at: string | null;
    }>(
      `
      SELECT
        id,
        attendance_date::text AS attendance_date,
        slot::text AS slot,
        status::text AS status,
        submitted_at::text AS submitted_at
      FROM attendance_sessions
      WHERE school_id = $1
        AND section_id = $2
        AND attendance_date = $3::date
        AND slot = $4
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [dto.schoolId, dto.sectionId, dto.attendanceDate, dto.slot],
    );

    const session = sessionResult.rows[0] ?? null;

    let recordsByStudent = new Map<
      string,
      {
        id: string;
        status: string;
        note: string | null;
      }
    >();

    if (session) {
      const recordsResult = await this.db.query<{
        id: string;
        student_id: string;
        status: string;
        note: string | null;
      }>(
        `
        SELECT
          id,
          student_id,
          status::text AS status,
          COALESCE(note_i18n->>'fr', note_i18n->>'en') AS note
        FROM attendance_records
        WHERE attendance_session_id = $1
          AND deleted_at IS NULL
        `,
        [session.id],
      );

      recordsByStudent = new Map(
        recordsResult.rows.map((row) => [
          row.student_id,
          {
            id: row.id,
            status: row.status,
            note: row.note,
          },
        ]),
      );
    }

    return {
      section: {
        id: section.id,
        code: section.code,
        nameI18n: section.name_i18n,
        gradeLevelCode: section.grade_level_code,
        gradeLevelNameI18n: section.grade_level_name_i18n,
      },
      session: session
        ? {
            id: session.id,
            attendanceDate: session.attendance_date,
            slot: session.slot,
            attendanceStatus: session.status,
            submittedAt: session.submitted_at,
          }
        : null,
      students: studentsResult.rows.map((row) => {
        const existing = recordsByStudent.get(row.student_id);

        return {
          id: row.student_id,
          studentCode: row.student_code,
          firstName: row.first_name,
          lastName: row.last_name,
          gender: row.gender,
          studentStatus: row.student_status,
          attendance: existing
            ? {
                id: existing.id,
                status: existing.status,
                note: existing.note,
              }
            : {
                id: null,
                status: 'PRESENT',
                note: null,
              },
        };
      }),
    };
  }

  async submitAttendanceSession(
    dto: SubmitAttendanceSessionDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAttendance(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    if (dto.records.length === 0) {
      throw new BadRequestException('Attendance records are required.');
    }

    const uniqueStudentIds = new Set(
      dto.records.map((record) => record.studentId),
    );

    if (uniqueStudentIds.size !== dto.records.length) {
      throw new BadRequestException(
        'Duplicate student records are not allowed in one attendance submission.',
      );
    }

    return this.db.withTransaction(async (client) => {
      const sectionResult = await client.query(
        `
        SELECT id
        FROM sections
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.sectionId, dto.schoolId],
      );

      if (!sectionResult.rows[0]) {
        throw new NotFoundException('Section not found for this school.');
      }

      const studentIds = dto.records.map((record) => record.studentId);

      const validStudentsResult = await client.query<{
        student_id: string;
      }>(
        `
        SELECT st.id AS student_id
        FROM enrollments en
        JOIN students st
          ON st.id = en.student_id
         AND st.deleted_at IS NULL
        WHERE en.section_id = $1
          AND en.deleted_at IS NULL
          AND en.enrollment_status = 'ACTIVE'
          AND st.school_id = $2
          AND st.id = ANY($3::uuid[])
        `,
        [dto.sectionId, dto.schoolId, studentIds],
      );

      const validStudentIds = new Set(
        validStudentsResult.rows.map((row) => row.student_id),
      );

      for (const record of dto.records) {
        if (!validStudentIds.has(record.studentId)) {
          throw new BadRequestException(
            'One or more students are not assigned to this class/section.',
          );
        }
      }

      const sessionResult = await client.query<{
        id: string;
      }>(
        `
        INSERT INTO attendance_sessions (
          school_id,
          section_id,
          attendance_date,
          slot,
          status,
          taken_by_user_id,
          submitted_at
        )
        VALUES ($1, $2, $3::date, $4, 'SUBMITTED', $5, NOW())
        ON CONFLICT (school_id, section_id, attendance_date, slot)
        WHERE deleted_at IS NULL
        DO UPDATE SET
          status = 'SUBMITTED',
          taken_by_user_id = EXCLUDED.taken_by_user_id,
          submitted_at = NOW(),
          updated_at = NOW()
        RETURNING id
        `,
        [
          dto.schoolId,
          dto.sectionId,
          dto.attendanceDate,
          dto.slot,
          actorUserId,
        ],
      );

      const sessionId = sessionResult.rows[0].id;

      for (const record of dto.records) {
        const trimmedNote = record.note?.trim() ?? '';
        const noteI18n = trimmedNote
          ? JSON.stringify({ fr: trimmedNote, en: trimmedNote })
          : null;

        await client.query(
          `
          INSERT INTO attendance_records (
            attendance_session_id,
            student_id,
            status,
            note_i18n
          )
          VALUES ($1, $2, $3, $4::jsonb)
          ON CONFLICT (attendance_session_id, student_id)
          WHERE deleted_at IS NULL
          DO UPDATE SET
            status = EXCLUDED.status,
            note_i18n = EXCLUDED.note_i18n,
            updated_at = NOW()
          `,
          [sessionId, record.studentId, record.status, noteI18n],
        );
      }

      const countsResult = await client.query<{
        status: string;
        count: string;
      }>(
        `
        SELECT
          status::text AS status,
          COUNT(*)::text AS count
        FROM attendance_records
        WHERE attendance_session_id = $1
          AND deleted_at IS NULL
        GROUP BY status
        `,
        [sessionId],
      );

      const counts = countsResult.rows.reduce(
        (acc, row) => {
          acc[row.status] = Number(row.count);
          return acc;
        },
        {} as Record<string, number>,
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'ATTENDANCE_SUBMITTED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Attendance submitted for ${dto.attendanceDate} ${dto.slot}.`,
        payload: {
          attendanceSessionId: sessionId,
          sectionId: dto.sectionId,
          attendanceDate: dto.attendanceDate,
          slot: dto.slot,
          counts,
        },
      });

      return {
        id: sessionId,
        schoolId: dto.schoolId,
        sectionId: dto.sectionId,
        attendanceDate: dto.attendanceDate,
        slot: dto.slot,
        counts,
        submittedAt: new Date().toISOString(),
      };
    });
  }
  async getOverview(
    schoolId: string,
    attendanceDate: string,
    allowedSectionIds?: string[],
  ) {
    const sectionsResult = await this.db.query<{
      section_id: string;
      section_code: string;
      section_name_i18n: Record<string, string>;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string>;
    }>(
      `
      SELECT
        se.id AS section_id,
        se.code AS section_code,
        se.name_i18n AS section_name_i18n,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n
      FROM sections se
      JOIN grade_levels gl ON gl.id = se.grade_level_id
      WHERE se.school_id = $1
        AND ($2::uuid[] IS NULL OR se.id = ANY($2::uuid[]))
        AND se.deleted_at IS NULL
        AND gl.deleted_at IS NULL
      ORDER BY gl.display_order ASC, se.code ASC
      `,
      [schoolId, allowedSectionIds ?? null],
    );

    const sessionsResult = await this.db.query<{
      attendance_session_id: string;
      section_id: string;
      slot: 'MORNING' | 'AFTERNOON';
      submitted_at: string | null;
      taken_by_user_id: string | null;
      session_status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
    }>(
      `
      SELECT
        ats.id AS attendance_session_id,
        ats.section_id,
        ats.slot,
        ats.submitted_at,
        ats.taken_by_user_id,
        ats.status AS session_status
      FROM attendance_sessions ats
      WHERE ats.school_id = $1
        AND ($3::uuid[] IS NULL OR ats.section_id = ANY($3::uuid[]))
        AND ats.attendance_date = $2
        AND ats.deleted_at IS NULL
      `,
      [schoolId, attendanceDate, allowedSectionIds ?? null],
    );

    const recordsResult = await this.db.query<{
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
      count: string;
    }>(
      `
      SELECT
        ar.status,
        COUNT(*)::text AS count
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
      WHERE ats.school_id = $1
        AND ($3::uuid[] IS NULL OR ats.section_id = ANY($3::uuid[]))
        AND ats.attendance_date = $2
        AND ats.deleted_at IS NULL
        AND ar.deleted_at IS NULL
      GROUP BY ar.status
      `,
      [schoolId, attendanceDate, allowedSectionIds ?? null],
    );

    const totals = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    for (const row of recordsResult.rows) {
      if (row.status === 'PRESENT') totals.present = Number(row.count);
      if (row.status === 'ABSENT') totals.absent = Number(row.count);
      if (row.status === 'LATE') totals.late = Number(row.count);
      if (row.status === 'EXCUSED') totals.excused = Number(row.count);
    }

    const sessionsBySection = new Map<string, typeof sessionsResult.rows>();

    for (const session of sessionsResult.rows) {
      const existing = sessionsBySection.get(session.section_id) ?? [];
      existing.push(session);
      sessionsBySection.set(session.section_id, existing);
    }

    const sectionBreakdown = sectionsResult.rows.map((section) => {
      const sessions = sessionsBySection.get(section.section_id) ?? [];

      const morning = sessions.find((session) => session.slot === 'MORNING');
      const afternoon = sessions.find(
        (session) => session.slot === 'AFTERNOON',
      );

      const morningCompleted =
        Boolean(morning?.submitted_at) ||
        morning?.session_status === 'SUBMITTED' ||
        morning?.session_status === 'LOCKED';

      const afternoonCompleted =
        Boolean(afternoon?.submitted_at) ||
        afternoon?.session_status === 'SUBMITTED' ||
        afternoon?.session_status === 'LOCKED';

      return {
        sectionId: section.section_id,
        sectionCode: section.section_code,
        sectionNameI18n: section.section_name_i18n,
        gradeLevelCode: section.grade_level_code,
        gradeLevelNameI18n: section.grade_level_name_i18n,
        morning: {
          exists: Boolean(morning),
          completed: morningCompleted,
          locked: morning?.session_status === 'LOCKED',
          sessionStatus: morning?.session_status ?? null,
          attendanceSessionId: morning?.attendance_session_id ?? null,
        },
        afternoon: {
          exists: Boolean(afternoon),
          completed: afternoonCompleted,
          locked: afternoon?.session_status === 'LOCKED',
          sessionStatus: afternoon?.session_status ?? null,
          attendanceSessionId: afternoon?.attendance_session_id ?? null,
        },
        completedSlots: Number(morningCompleted) + Number(afternoonCompleted),
        missingSlots: Number(!morningCompleted) + Number(!afternoonCompleted),
        isComplete: morningCompleted && afternoonCompleted,
      };
    });

    const expectedSessions = sectionsResult.rows.length * 2;
    const completedSessions = sectionBreakdown.reduce(
      (sum, section) => sum + section.completedSlots,
      0,
    );
    const missingSessions = expectedSessions - completedSessions;

    return {
      schoolId,
      attendanceDate,
      totals,
      summary: {
        sections: sectionsResult.rows.length,
        expectedSessions,
        completedSessions,
        missingSessions,
        completionPercent:
          expectedSessions > 0
            ? Number(((completedSessions / expectedSessions) * 100).toFixed(0))
            : 0,
      },
      sectionBreakdown,
    };
  }
  async getAttendanceDashboard(
    input: {
      schoolId: string;
      attendanceDate: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
    allowedSectionIds?: string[],
  ) {
    await this.assertUserCanAccessAttendance(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const result = await this.db.query<{
      section_id: string;
      section_code: string;
      section_name_i18n: Record<string, string> | null;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string> | null;
      slot: string | null;
      attendance_status: string | null;
      record_count: string;
    }>(
      `
      SELECT
        se.id AS section_id,
        se.code AS section_code,
        se.name_i18n AS section_name_i18n,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n,
        sess.slot::text AS slot,
        rec.status::text AS attendance_status,
        COUNT(rec.id)::text AS record_count
      FROM sections se
      JOIN grade_levels gl
        ON gl.id = se.grade_level_id
       AND gl.deleted_at IS NULL
      LEFT JOIN attendance_sessions sess
        ON sess.section_id = se.id
       AND sess.school_id = se.school_id
       AND sess.attendance_date = $2::date
       AND sess.deleted_at IS NULL
      LEFT JOIN attendance_records rec
        ON rec.attendance_session_id = sess.id
       AND rec.deleted_at IS NULL
      WHERE se.school_id = $1
        AND ($2::uuid[] IS NULL OR se.id = ANY($2::uuid[]))
        AND se.deleted_at IS NULL
      GROUP BY
        se.id,
        gl.id,
        sess.slot,
        rec.status
      ORDER BY
        COALESCE(gl.display_order, 9999),
        COALESCE(se.display_order, 9999),
        se.code ASC
      `,
      [input.schoolId, input.attendanceDate, allowedSectionIds ?? null],
    );

    const sections = new Map<
      string,
      {
        sectionId: string;
        sectionCode: string;
        sectionNameI18n: Record<string, string> | null;
        gradeLevelCode: string;
        gradeLevelNameI18n: Record<string, string> | null;
        morningSubmitted: boolean;
        afternoonSubmitted: boolean;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }
    >();

    const totals = {
      sessionsSubmitted: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    const submittedSessionKeys = new Set<string>();

    for (const row of result.rows) {
      if (!sections.has(row.section_id)) {
        sections.set(row.section_id, {
          sectionId: row.section_id,
          sectionCode: row.section_code,
          sectionNameI18n: row.section_name_i18n,
          gradeLevelCode: row.grade_level_code,
          gradeLevelNameI18n: row.grade_level_name_i18n,
          morningSubmitted: false,
          afternoonSubmitted: false,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        });
      }

      const section = sections.get(row.section_id)!;

      if (row.slot) {
        const sessionKey = `${row.section_id}-${row.slot}`;

        if (!submittedSessionKeys.has(sessionKey)) {
          submittedSessionKeys.add(sessionKey);
          totals.sessionsSubmitted += 1;
        }

        if (row.slot === 'MORNING') section.morningSubmitted = true;
        if (row.slot === 'AFTERNOON') section.afternoonSubmitted = true;
      }

      const count = Number(row.record_count ?? 0);

      if (row.attendance_status === 'PRESENT') {
        section.present += count;
        totals.present += count;
      }

      if (row.attendance_status === 'ABSENT') {
        section.absent += count;
        totals.absent += count;
      }

      if (row.attendance_status === 'LATE') {
        section.late += count;
        totals.late += count;
      }

      if (row.attendance_status === 'EXCUSED') {
        section.excused += count;
        totals.excused += count;
      }
    }

    return {
      attendanceDate: input.attendanceDate,
      totals,
      bySection: Array.from(sections.values()),
    };
  }
  async getStudentAttendanceHistory(
    input: {
      schoolId: string;
      studentId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAttendance(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const studentResult = await this.db.query(
      `
      SELECT id
      FROM students
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.studentId, input.schoolId],
    );

    if (!studentResult.rows[0]) {
      throw new NotFoundException('Student not found for this school.');
    }

    const result = await this.db.query<{
      attendance_date: string;
      slot: string;
      attendance_status: string;
      note: string | null;
      submitted_at: string | null;
      section_code: string;
      section_name_i18n: Record<string, string> | null;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string> | null;
    }>(
      `
      SELECT
        sess.attendance_date::text AS attendance_date,
        sess.slot::text AS slot,
        rec.status::text AS attendance_status,
        COALESCE(rec.note_i18n->>'fr', rec.note_i18n->>'en') AS note,
        sess.submitted_at::text AS submitted_at,
        se.code AS section_code,
        se.name_i18n AS section_name_i18n,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n
      FROM attendance_records rec
      JOIN attendance_sessions sess
        ON sess.id = rec.attendance_session_id
       AND sess.deleted_at IS NULL
      JOIN sections se
        ON se.id = sess.section_id
       AND se.deleted_at IS NULL
      JOIN grade_levels gl
        ON gl.id = se.grade_level_id
       AND gl.deleted_at IS NULL
      WHERE sess.school_id = $1
        AND rec.student_id = $2
        AND rec.deleted_at IS NULL
      ORDER BY sess.attendance_date DESC, sess.slot ASC
      LIMIT 100
      `,
      [input.schoolId, input.studentId],
    );

    const totals = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    const records = result.rows.map((row) => {
      if (row.attendance_status === 'PRESENT') totals.present += 1;
      if (row.attendance_status === 'ABSENT') totals.absent += 1;
      if (row.attendance_status === 'LATE') totals.late += 1;
      if (row.attendance_status === 'EXCUSED') totals.excused += 1;

      return {
        attendanceDate: row.attendance_date,
        slot: row.slot,
        status: row.attendance_status,
        note: row.note,
        submittedAt: row.submitted_at,
        section: {
          code: row.section_code,
          nameI18n: row.section_name_i18n,
        },
        gradeLevel: {
          code: row.grade_level_code,
          nameI18n: row.grade_level_name_i18n,
        },
      };
    });

    return {
      totals,
      records,
    };
  }
  async lockSession(
    attendanceSessionId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const schoolId = await this.assertUserCanLockAttendanceSession(
      actorUserId,
      attendanceSessionId,
      platformRole,
    );

    const result = await this.db.query<{
      id: string;
      school_id: string;
      section_id: string;
      attendance_date: string;
      slot: string;
      session_status: string;
    }>(
      `
      UPDATE attendance_sessions
      SET
        status = 'LOCKED',
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
        AND status = 'SUBMITTED'
      RETURNING
        id,
        school_id,
        section_id,
        attendance_date,
        slot,
        status AS session_status
      `,
      [attendanceSessionId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(
        `Attendance session ${attendanceSessionId} not found or cannot be locked.`,
      );
    }

    await this.platformActivityService.record({
      eventType: 'ATTENDANCE_LOCKED',
      actorType: platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
      actorUserId,
      schoolId,
      summary: 'Attendance session was locked after admin review.',
      payload: {
        attendanceSessionId,
      },
    });

    return result.rows[0];
  }

  private async queueAbsenceNotifications(
    client: PoolClient,
    input: {
      schoolId: string;
      attendanceSessionId: string;
      attendanceDate: string;
      slot: 'MORNING' | 'AFTERNOON';
      records: Array<{
        studentId: string;
        status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
        note?: string;
      }>;
    },
  ) {
    const absentRecords = input.records.filter(
      (record) => record.status === 'ABSENT',
    );

    for (const record of absentRecords) {
      await client.query(
        `
        INSERT INTO notification_outbox (
          school_id,
          student_id,
          event_type,
          channel,
          dedupe_key,
          payload
        )
        VALUES (
          $1,
          $2,
          'ATTENDANCE_ABSENCE_ALERT',
          'EMAIL',
          $3,
          $4::jsonb
        )
        ON CONFLICT (dedupe_key) DO NOTHING
        `,
        [
          input.schoolId,
          record.studentId,
          `${input.attendanceSessionId}:ABSENCE:${record.studentId}`,
          JSON.stringify({
            attendanceSessionId: input.attendanceSessionId,
            attendanceDate: input.attendanceDate,
            slot: input.slot,
            status: record.status,
            note: record.note ?? null,
            message:
              'Student was marked absent. Parent notification processing will be handled by the notification worker later.',
          }),
        ],
      );
    }
  }
  private validateDuplicateStudents(studentIds: string[]) {
    const uniqueIds = new Set(studentIds);

    if (uniqueIds.size !== studentIds.length) {
      throw new BadRequestException(
        'Duplicate student IDs were found in the attendance payload.',
      );
    }
  }

  private async getSectionRosterForValidation(
    client: PoolClient,
    sectionId: string,
  ): Promise<AttendanceRosterRow[]> {
    const result = await client.query<AttendanceRosterRow>(
      `
      SELECT
        s.id AS student_id,
        s.student_number,
        s.first_name,
        s.last_name
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE e.section_id = $1
        AND e.enrollment_status = 'ACTIVE'
        AND e.deleted_at IS NULL
        AND s.deleted_at IS NULL
      ORDER BY s.last_name ASC, s.first_name ASC
      `,
      [sectionId],
    );

    return result.rows;
  }

  private async upsertAttendanceSession(
    client: PoolClient,
    dto: SubmitAttendanceSessionDto,
  ): Promise<AttendanceSessionRow> {
    const result = await client.query<AttendanceSessionRow>(
      `
      INSERT INTO attendance_sessions (
        school_id,
        section_id,
        attendance_date,
        slot,
        status,
        taken_by_user_id,
        submitted_at
      )
      SELECT
        sec.school_id,
        $1,
        $2,
        $3,
        'SUBMITTED',
        $4,
        NOW()
      FROM sections sec
      WHERE sec.id = $1
        AND sec.deleted_at IS NULL
      ON CONFLICT (section_id, attendance_date, slot)
      DO UPDATE SET
        status = EXCLUDED.status,
        taken_by_user_id = EXCLUDED.taken_by_user_id,
        submitted_at = EXCLUDED.submitted_at,
        updated_at = NOW()
      RETURNING
        id,
        school_id,
        section_id,
        attendance_date,
        slot,
        status,
        taken_by_user_id,
        submitted_at,
        created_at,
        updated_at
      `,
      [dto.sectionId, dto.attendanceDate, dto.slot, dto.takenByUserId],
    );

    const session = result.rows[0];

    if (!session) {
      throw new BadRequestException('Section not found.');
    }

    return session;
  }
}
