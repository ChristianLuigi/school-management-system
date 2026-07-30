import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { validateFinancePermissions } from '../auth/security/finance-permission-policy';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { UpdateFinancePermissionsDto } from './dto/update-finance-permissions.dto';
import { UpdateParentGuardianLinksDto } from './dto/update-parent-guardian-links.dto';
import { UpdateTeacherAssignmentsDto } from './dto/update-teacher-assignments.dto';

@Injectable()
export class AccessManagementService {
  constructor(
    private readonly db: DbService,
    private readonly activity: PlatformActivityService,
  ) {}

  private async assertAdministrator(
    schoolId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    if (platformRole === 'SUPER_ADMIN') return;
    const result = await this.db.query(
      `
      SELECT sm.id FROM school_memberships sm
      JOIN school_membership_roles smr ON smr.school_membership_id=sm.id
      WHERE sm.school_id=$1 AND sm.user_id=$2 AND sm.membership_status='ACTIVE'
        AND sm.deleted_at IS NULL AND smr.role='SCHOOL_ADMIN' AND smr.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM school_staff_accounts staff
          WHERE staff.school_id=sm.school_id AND staff.user_id=sm.user_id
            AND staff.employment_status IN ('ACTIVE','ON_LEAVE')
            AND staff.deleted_at IS NULL
        )
      LIMIT 1
    `,
      [schoolId, actorUserId],
    );
    if (!result.rowCount)
      throw new ForbiddenException('School administrator access is required.');
  }

  private async assertUserRole(
    schoolId: string,
    userId: string,
    roleCode: string,
  ) {
    const result = await this.db.query(
      `
      SELECT sm.id FROM school_memberships sm
      JOIN school_membership_roles smr ON smr.school_membership_id=sm.id
      WHERE sm.school_id=$1 AND sm.user_id=$2 AND sm.membership_status='ACTIVE'
        AND sm.deleted_at IS NULL AND smr.role::text=$3 AND smr.deleted_at IS NULL
        AND (
          $3 = 'PARENT'
          OR EXISTS (
            SELECT 1 FROM school_staff_accounts staff
            WHERE staff.school_id=sm.school_id AND staff.user_id=sm.user_id
              AND staff.employment_status IN ('ACTIVE','ON_LEAVE')
              AND staff.deleted_at IS NULL
          )
        )
      LIMIT 1
    `,
      [schoolId, userId, roleCode],
    );
    if (!result.rowCount)
      throw new BadRequestException(
        `The selected user does not have the ${roleCode} role.`,
      );
  }

  private async invalidateSessionsTx(
    client: PoolClient,
    userId: string,
    reason: string,
  ) {
    await client.query(
      `UPDATE users SET authentication_version=authentication_version+1,updated_at=NOW() WHERE id=$1`,
      [userId],
    );
    await client.query(
      `
      UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),revocation_reason=COALESCE(revocation_reason,$2)
      WHERE user_id=$1 AND revoked_at IS NULL
    `,
      [userId, reason],
    );
  }

  async listGuardianOptions(
    schoolId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertAdministrator(schoolId, actorUserId, platformRole);
    const result = await this.db.query<{
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      linked_user_id: string | null;
    }>(
      `
      SELECT g.id,COALESCE(g.full_name,NULLIF(BTRIM(CONCAT_WS(' ',g.first_name,g.last_name)),''),'Guardian') AS full_name,
        COALESCE(g.email,g.email_override,u.email_original) AS email,
        COALESCE(g.phone_primary,g.phone) AS phone,g.user_id AS linked_user_id
      FROM guardians g LEFT JOIN users u ON u.id=g.user_id AND u.deleted_at IS NULL
      WHERE g.school_id=$1 AND g.deleted_at IS NULL ORDER BY full_name
    `,
      [schoolId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      linkedUserId: row.linked_user_id,
    }));
  }

  async updateTeacherAssignments(
    teacherUserId: string,
    dto: UpdateTeacherAssignmentsDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertAdministrator(dto.schoolId, actorUserId, platformRole);
    await this.assertUserRole(dto.schoolId, teacherUserId, 'TEACHER');
    const year = await this.db.query(
      `SELECT id FROM academic_years WHERE id=$1 AND school_id=$2 AND deleted_at IS NULL LIMIT 1`,
      [dto.academicYearId, dto.schoolId],
    );
    if (!year.rowCount)
      throw new BadRequestException('Academic year not found for this school.');
    const assignments = Array.from(
      new Map(
        dto.assignments.map((value) => [
          `${value.sectionId}:${value.subjectId}`,
          value,
        ]),
      ).values(),
    );
    for (const assignment of assignments) {
      const valid = await this.db.query(
        `
        SELECT sec.id FROM sections sec
        JOIN grade_level_subjects gls ON gls.school_id=sec.school_id AND gls.grade_level_id=sec.grade_level_id AND gls.deleted_at IS NULL
        JOIN school_subjects subj ON subj.id=gls.subject_id AND subj.school_id=sec.school_id AND subj.deleted_at IS NULL
        WHERE sec.id=$1 AND sec.school_id=$2 AND sec.academic_year_id=$3 AND sec.deleted_at IS NULL AND subj.id=$4 LIMIT 1
      `,
        [
          assignment.sectionId,
          dto.schoolId,
          dto.academicYearId,
          assignment.subjectId,
        ],
      );
      if (!valid.rowCount)
        throw new BadRequestException(
          'A selected subject is not available for the selected section.',
        );
    }
    await this.db.withTransaction(async (client) => {
      await client.query(
        `
        UPDATE teacher_academic_assignments SET deleted_at=NOW(),assignment_status='ARCHIVED',updated_at=NOW()
        WHERE school_id=$1 AND teacher_user_id=$2 AND academic_year_id=$3 AND deleted_at IS NULL
      `,
        [dto.schoolId, teacherUserId, dto.academicYearId],
      );
      for (const assignment of assignments) {
        await client.query(
          `
          INSERT INTO teacher_academic_assignments
            (school_id,teacher_user_id,academic_year_id,section_id,subject_id,assignment_status,assigned_by_user_id)
          VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6)
        `,
          [
            dto.schoolId,
            teacherUserId,
            dto.academicYearId,
            assignment.sectionId,
            assignment.subjectId,
            actorUserId,
          ],
        );
      }
      await this.invalidateSessionsTx(
        client,
        teacherUserId,
        'TEACHER_ASSIGNMENTS_CHANGED',
      );
      await this.activity.recordTx(client, {
        eventType: 'TEACHER_ASSIGNMENTS_CHANGED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: 'Teacher academic assignments updated.',
        payload: {
          teacherUserId,
          academicYearId: dto.academicYearId,
          assignments,
        },
      });
    });
    return {
      updated: true,
      teacherUserId,
      assignmentCount: assignments.length,
      sessionsRevoked: true,
    };
  }

  async updateFinancePermissions(
    financeUserId: string,
    dto: UpdateFinancePermissionsDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertAdministrator(dto.schoolId, actorUserId, platformRole);
    await this.assertUserRole(dto.schoolId, financeUserId, 'FINANCE_ADMIN');
    const permissionCodes = validateFinancePermissions(dto.permissionCodes);
    await this.db.withTransaction(async (client) => {
      await client.query(
        `UPDATE school_user_permissions SET deleted_at=NOW(),updated_at=NOW() WHERE school_id=$1 AND user_id=$2 AND deleted_at IS NULL`,
        [dto.schoolId, financeUserId],
      );
      for (const code of permissionCodes) {
        await client.query(
          `INSERT INTO school_user_permissions (school_id,user_id,permission_code,granted_by_user_id) VALUES ($1,$2,$3,$4)`,
          [dto.schoolId, financeUserId, code, actorUserId],
        );
      }
      await this.invalidateSessionsTx(
        client,
        financeUserId,
        'FINANCE_PERMISSIONS_CHANGED',
      );
      await this.activity.recordTx(client, {
        eventType: 'FINANCE_PERMISSIONS_CHANGED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: 'Finance permissions updated.',
        payload: { financeUserId, permissionCodes },
      });
    });
    return {
      updated: true,
      financeUserId,
      permissionCodes,
      sessionsRevoked: true,
    };
  }

  async updateParentGuardianLinks(
    parentUserId: string,
    dto: UpdateParentGuardianLinksDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertAdministrator(dto.schoolId, actorUserId, platformRole);
    await this.assertUserRole(dto.schoolId, parentUserId, 'PARENT');
    const guardianIds = [...new Set(dto.guardianIds)];
    const guardians = await this.db.query<{ id: string }>(
      `SELECT id FROM guardians WHERE school_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL`,
      [dto.schoolId, guardianIds],
    );
    if (guardians.rows.length !== guardianIds.length)
      throw new BadRequestException(
        'One or more guardian records do not belong to this school.',
      );
    await this.db.withTransaction(async (client) => {
      await client.query(
        `UPDATE guardian_account_links SET deleted_at=NOW(),updated_at=NOW() WHERE school_id=$1 AND user_id=$2 AND deleted_at IS NULL`,
        [dto.schoolId, parentUserId],
      );
      for (const guardianId of guardianIds) {
        await client.query(
          `INSERT INTO guardian_account_links (school_id,user_id,guardian_id,created_by_user_id) VALUES ($1,$2,$3,$4)`,
          [dto.schoolId, parentUserId, guardianId, actorUserId],
        );
      }
      await this.invalidateSessionsTx(
        client,
        parentUserId,
        'GUARDIAN_LINKS_CHANGED',
      );
      await this.activity.recordTx(client, {
        eventType: 'GUARDIAN_ACCOUNT_LINKS_CHANGED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: 'Parent guardian links updated.',
        payload: { parentUserId, guardianIds },
      });
    });
    return { updated: true, parentUserId, guardianIds, sessionsRevoked: true };
  }

  async hasFinancePermission(
    userId: string,
    schoolId: string,
    permissionCode: string,
  ) {
    const result = await this.db.query(
      `
      SELECT permission.id FROM school_user_permissions permission
      JOIN school_memberships sm ON sm.school_id=permission.school_id AND sm.user_id=permission.user_id
        AND sm.membership_status='ACTIVE' AND sm.deleted_at IS NULL
      JOIN school_membership_roles smr ON smr.school_membership_id=sm.id AND smr.role='FINANCE_ADMIN' AND smr.deleted_at IS NULL
      JOIN school_staff_accounts staff ON staff.school_id=sm.school_id AND staff.user_id=sm.user_id
        AND staff.employment_status IN ('ACTIVE','ON_LEAVE') AND staff.deleted_at IS NULL
      WHERE permission.school_id=$1 AND permission.user_id=$2 AND permission.permission_code=$3 AND permission.deleted_at IS NULL LIMIT 1
    `,
      [schoolId, userId, permissionCode],
    );
    return Boolean(result.rowCount);
  }

  async assertFinancePermission(
    userId: string,
    schoolId: string,
    permissionCode: string,
  ) {
    if (!(await this.hasFinancePermission(userId, schoolId, permissionCode)))
      throw new ForbiddenException(
        'You do not have the required finance permission.',
      );
  }

  async getTeacherAssignmentScopes(teacherUserId: string, schoolId: string) {
    const result = await this.db.query<{
      section_id: string;
      subject_id: string;
      subject_code: string;
    }>(
      `
      SELECT DISTINCT assignment.section_id,assignment.subject_id,subject.code AS subject_code
      FROM teacher_academic_assignments assignment
      JOIN school_subjects subject ON subject.id=assignment.subject_id AND subject.school_id=assignment.school_id AND subject.deleted_at IS NULL
      JOIN school_memberships sm ON sm.school_id=assignment.school_id AND sm.user_id=assignment.teacher_user_id
        AND sm.membership_status='ACTIVE' AND sm.deleted_at IS NULL
      JOIN school_membership_roles smr ON smr.school_membership_id=sm.id AND smr.role='TEACHER' AND smr.deleted_at IS NULL
      JOIN school_staff_accounts staff ON staff.school_id=sm.school_id AND staff.user_id=sm.user_id
        AND staff.employment_status IN ('ACTIVE','ON_LEAVE') AND staff.deleted_at IS NULL
      WHERE assignment.teacher_user_id=$1 AND assignment.school_id=$2
        AND assignment.assignment_status='ACTIVE' AND assignment.deleted_at IS NULL
    `,
      [teacherUserId, schoolId],
    );
    return result.rows.map((row) => ({
      sectionId: row.section_id,
      subjectId: row.subject_id,
      subjectCode: row.subject_code,
    }));
  }
  async getTeacherSectionIds(teacherUserId: string, schoolId: string) {
    const result = await this.db.query<{ section_id: string }>(
      `
      SELECT DISTINCT assignment.section_id FROM teacher_academic_assignments assignment
      JOIN school_memberships sm ON sm.school_id=assignment.school_id AND sm.user_id=assignment.teacher_user_id
        AND sm.membership_status='ACTIVE' AND sm.deleted_at IS NULL
      JOIN school_membership_roles smr ON smr.school_membership_id=sm.id AND smr.role='TEACHER' AND smr.deleted_at IS NULL
      JOIN school_staff_accounts staff ON staff.school_id=sm.school_id AND staff.user_id=sm.user_id
        AND staff.employment_status IN ('ACTIVE','ON_LEAVE') AND staff.deleted_at IS NULL
      WHERE assignment.teacher_user_id=$1 AND assignment.school_id=$2
        AND assignment.assignment_status='ACTIVE' AND assignment.deleted_at IS NULL
    `,
      [teacherUserId, schoolId],
    );
    return result.rows.map((row) => row.section_id);
  }
  async assertTeacherAssignment(
    teacherUserId: string,
    schoolId: string,
    academicYearId: string,
    sectionId: string,
    subjectId?: string,
  ) {
    const values: unknown[] = [
      teacherUserId,
      schoolId,
      academicYearId,
      sectionId,
    ];
    let subjectFilter = '';
    if (subjectId) {
      values.push(subjectId);
      subjectFilter = 'AND assignment.subject_id=$5';
    }
    const result = await this.db.query(
      `
      SELECT assignment.id FROM teacher_academic_assignments assignment
      JOIN school_memberships sm ON sm.school_id=assignment.school_id AND sm.user_id=assignment.teacher_user_id
        AND sm.membership_status='ACTIVE' AND sm.deleted_at IS NULL
      JOIN school_membership_roles smr ON smr.school_membership_id=sm.id AND smr.role='TEACHER' AND smr.deleted_at IS NULL
      JOIN school_staff_accounts staff ON staff.school_id=sm.school_id AND staff.user_id=sm.user_id
        AND staff.employment_status IN ('ACTIVE','ON_LEAVE') AND staff.deleted_at IS NULL
      WHERE assignment.teacher_user_id=$1 AND assignment.school_id=$2 AND assignment.academic_year_id=$3
        AND assignment.section_id=$4 ${subjectFilter} AND assignment.assignment_status='ACTIVE' AND assignment.deleted_at IS NULL LIMIT 1
    `,
      values,
    );
    if (!result.rowCount)
      throw new ForbiddenException(
        'This section or subject is not assigned to the teacher.',
      );
  }

  async assertTeacherSubjectAssignment(
    teacherUserId: string,
    schoolId: string,
    sectionId: string,
    subjectId: string,
  ) {
    const section = await this.db.query<{ academic_year_id: string }>(
      `SELECT academic_year_id FROM sections WHERE id=$1 AND school_id=$2 AND deleted_at IS NULL LIMIT 1`,
      [sectionId, schoolId],
    );
    if (!section.rows[0])
      throw new BadRequestException('Section not found for this school.');
    await this.assertTeacherAssignment(
      teacherUserId,
      schoolId,
      section.rows[0].academic_year_id,
      sectionId,
      subjectId,
    );
  }
  async assertTeacherSectionAssignment(
    teacherUserId: string,
    schoolId: string,
    sectionId: string,
  ) {
    const section = await this.db.query<{ academic_year_id: string }>(
      `SELECT academic_year_id FROM sections WHERE id=$1 AND school_id=$2 AND deleted_at IS NULL LIMIT 1`,
      [sectionId, schoolId],
    );
    if (!section.rows[0])
      throw new BadRequestException('Section not found for this school.');
    await this.assertTeacherAssignment(
      teacherUserId,
      schoolId,
      section.rows[0].academic_year_id,
      sectionId,
    );
  }

  async assertTeacherAssessmentAssignment(
    teacherUserId: string,
    schoolId: string,
    assessmentId: string,
  ) {
    const result = await this.db.query<{
      academic_year_id: string;
      section_id: string;
      subject_id: string;
    }>(
      `
      SELECT sec.academic_year_id,assessment.section_id,assessment.subject_id
      FROM gradebook_assessments assessment
      JOIN sections sec ON sec.id=assessment.section_id AND sec.school_id=assessment.school_id AND sec.deleted_at IS NULL
      WHERE assessment.id=$1 AND assessment.school_id=$2 AND assessment.deleted_at IS NULL LIMIT 1
    `,
      [assessmentId, schoolId],
    );
    const assessment = result.rows[0];
    if (!assessment?.subject_id)
      throw new ForbiddenException(
        'This assessment is not available in the teacher assignment scope.',
      );
    await this.assertTeacherAssignment(
      teacherUserId,
      schoolId,
      assessment.academic_year_id,
      assessment.section_id,
      assessment.subject_id,
    );
  }

  async getSectionScope(sectionId: string) {
    const result = await this.db.query<{
      school_id: string;
      academic_year_id: string;
    }>(
      `
      SELECT school_id, academic_year_id
      FROM sections
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
      [sectionId],
    );
    const section = result.rows[0];
    if (!section) {
      throw new BadRequestException('Section not found.');
    }
    return {
      schoolId: section.school_id,
      academicYearId: section.academic_year_id,
    };
  }

  async getAttendanceSessionScope(attendanceSessionId: string) {
    const result = await this.db.query<{
      school_id: string;
      section_id: string;
    }>(
      `
      SELECT school_id, section_id
      FROM attendance_sessions
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
      [attendanceSessionId],
    );
    const attendanceSession = result.rows[0];
    if (!attendanceSession) {
      throw new BadRequestException('Attendance session not found.');
    }
    return {
      schoolId: attendanceSession.school_id,
      sectionId: attendanceSession.section_id,
    };
  }

  async getLegacySectionSubjectScope(sectionSubjectId: string) {
    const result = await this.db.query<{
      school_id: string;
      academic_year_id: string;
      section_id: string;
      subject_code: string;
    }>(
      `
      SELECT
        section_subject.school_id,
        section_subject.academic_year_id,
        section_subject.section_id,
        subject.code AS subject_code
      FROM section_subjects section_subject
      JOIN subjects subject
        ON subject.id = section_subject.subject_id
       AND subject.deleted_at IS NULL
      WHERE section_subject.id = $1
        AND section_subject.deleted_at IS NULL
      LIMIT 1
    `,
      [sectionSubjectId],
    );
    const scope = result.rows[0];
    if (!scope) {
      throw new BadRequestException('Section subject not found.');
    }
    return {
      schoolId: scope.school_id,
      academicYearId: scope.academic_year_id,
      sectionId: scope.section_id,
      subjectCode: scope.subject_code,
    };
  }

  async getLegacyGradebookScope(gradebookId: string) {
    const result = await this.db.query<{ section_subject_id: string }>(
      `
      SELECT section_subject_id
      FROM gradebooks
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
      [gradebookId],
    );
    const gradebook = result.rows[0];
    if (!gradebook) {
      throw new BadRequestException('Gradebook not found.');
    }
    return this.getLegacySectionSubjectScope(gradebook.section_subject_id);
  }

  async assertTeacherLegacySubjectAssignment(
    teacherUserId: string,
    input: {
      schoolId: string;
      academicYearId: string;
      sectionId: string;
      subjectCode: string;
    },
  ) {
    const subject = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM school_subjects
      WHERE school_id = $1
        AND code = $2
        AND deleted_at IS NULL
      LIMIT 1
    `,
      [input.schoolId, input.subjectCode],
    );
    if (!subject.rows[0]) {
      throw new ForbiddenException(
        'This subject is not assigned to the teacher.',
      );
    }
    await this.assertTeacherAssignment(
      teacherUserId,
      input.schoolId,
      input.academicYearId,
      input.sectionId,
      subject.rows[0].id,
    );
  }
  async assertTeacherStudentAssignment(
    teacherUserId: string,
    schoolId: string,
    studentId: string,
  ) {
    const result = await this.db.query(
      `
      SELECT assignment.id
      FROM teacher_academic_assignments assignment
      JOIN enrollments enrollment
        ON enrollment.section_id = assignment.section_id
       AND enrollment.academic_year_id = assignment.academic_year_id
       AND enrollment.student_id = $3
       AND enrollment.enrollment_status = 'ACTIVE'
       AND enrollment.deleted_at IS NULL
      JOIN school_memberships sm
        ON sm.school_id = assignment.school_id
       AND sm.user_id = assignment.teacher_user_id
       AND sm.membership_status = 'ACTIVE'
       AND sm.deleted_at IS NULL
      JOIN school_membership_roles smr
        ON smr.school_membership_id = sm.id
       AND smr.role = 'TEACHER'
       AND smr.deleted_at IS NULL
      WHERE assignment.teacher_user_id = $1
        AND assignment.school_id = $2
        AND assignment.assignment_status = 'ACTIVE'
        AND assignment.deleted_at IS NULL
      LIMIT 1
    `,
      [teacherUserId, schoolId, studentId],
    );
    if (!result.rowCount) {
      throw new ForbiddenException(
        'This student is not in a section assigned to the teacher.',
      );
    }
  }
  async assertParentGuardianStudent(
    parentUserId: string,
    guardianId: string,
    studentId: string,
  ) {
    const result = await this.db.query<{ school_id: string }>(
      `
      SELECT link.school_id FROM guardian_account_links link
      JOIN guardians g ON g.id=link.guardian_id AND g.school_id=link.school_id AND g.deleted_at IS NULL
      JOIN student_guardians sg ON sg.guardian_id=g.id AND sg.student_id=$3 AND sg.deleted_at IS NULL
      JOIN students st ON st.id=sg.student_id AND st.school_id=link.school_id AND st.deleted_at IS NULL
      JOIN school_memberships sm ON sm.school_id=link.school_id AND sm.user_id=link.user_id
        AND sm.membership_status='ACTIVE' AND sm.deleted_at IS NULL
      JOIN school_membership_roles smr ON smr.school_membership_id=sm.id AND smr.role='PARENT' AND smr.deleted_at IS NULL
      WHERE link.user_id=$1 AND link.guardian_id=$2 AND link.deleted_at IS NULL LIMIT 1
    `,
      [parentUserId, guardianId, studentId],
    );
    if (!result.rows[0])
      throw new ForbiddenException(
        'This student is not linked to your account.',
      );
    return result.rows[0].school_id;
  }
  async getParentStudentIds(parentUserId: string, schoolId: string) {
    const result = await this.db.query<{ student_id: string }>(
      `
      SELECT DISTINCT sg.student_id FROM guardian_account_links link
      JOIN guardians g ON g.id=link.guardian_id AND g.school_id=link.school_id AND g.deleted_at IS NULL
      JOIN student_guardians sg ON sg.guardian_id=g.id AND sg.deleted_at IS NULL
      JOIN students st ON st.id=sg.student_id AND st.school_id=link.school_id AND st.deleted_at IS NULL
      JOIN school_memberships sm ON sm.school_id=link.school_id AND sm.user_id=link.user_id
        AND sm.membership_status='ACTIVE' AND sm.deleted_at IS NULL
      JOIN school_membership_roles smr ON smr.school_membership_id=sm.id AND smr.role='PARENT' AND smr.deleted_at IS NULL
      WHERE link.user_id=$1 AND link.school_id=$2 AND link.deleted_at IS NULL
    `,
      [parentUserId, schoolId],
    );
    return result.rows.map((row) => row.student_id);
  }

  async assertParentStudent(
    parentUserId: string,
    schoolId: string,
    studentId: string,
  ) {
    const allowed = await this.getParentStudentIds(parentUserId, schoolId);
    if (!allowed.includes(studentId))
      throw new ForbiddenException(
        'This student is not linked to your account.',
      );
  }
}
