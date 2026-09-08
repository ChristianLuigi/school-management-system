import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';

type SectionSubjectRow = {
  id: string;
  school_id: string;
  academic_year_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  coefficient: string;
  grading_configuration_id: string | null;
  is_active: boolean;
  section_code: string;
  section_name_i18n: Record<string, string>;
  subject_code: string;
  subject_name_i18n: Record<string, string>;
  teacher_first_name: string;
  teacher_last_name: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class SectionSubjectsService {
  constructor(private readonly db: DbService) {}

  async findAll(
    academicYearId: string,
    sectionId: string | undefined,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ): Promise<SectionSubjectRow[]> {
    const yearResult = await this.db.query<{ school_id: string }>(
      `
      SELECT school_id
      FROM academic_years
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [academicYearId],
    );
    const year = yearResult.rows[0];

    if (!year) {
      throw new NotFoundException('Academic year not found.');
    }

    let teacherScoped = false;

    if (platformRole !== 'SUPER_ADMIN') {
      const rolesResult = await this.db.query<{ role: string }>(
        `
        SELECT role.role::text AS role
        FROM school_memberships membership
        JOIN school_membership_roles role
          ON role.school_membership_id = membership.id
         AND role.deleted_at IS NULL
        JOIN school_staff_accounts staff
          ON staff.school_id = membership.school_id
         AND staff.user_id = membership.user_id
         AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
         AND staff.deleted_at IS NULL
        WHERE membership.school_id = $1
          AND membership.user_id = $2
          AND membership.membership_status = 'ACTIVE'
          AND membership.deleted_at IS NULL
          AND role.role IN ('SCHOOL_ADMIN', 'TEACHER')
        `,
        [year.school_id, actorUserId],
      );
      const roles = rolesResult.rows.map((row) => row.role);

      if (!roles.length) {
        throw new ForbiddenException(
          'Active school academic access is required.',
        );
      }
      teacherScoped = !roles.includes('SCHOOL_ADMIN');
    }

    const result = await this.db.query<SectionSubjectRow>(
      `
      SELECT
        section_subject.id,
        section_subject.school_id,
        section_subject.academic_year_id,
        section_subject.section_id,
        section_subject.subject_id,
        section_subject.teacher_id,
        section_subject.coefficient,
        section_subject.grading_configuration_id,
        section_subject.is_active,
        section.code AS section_code,
        section.name_i18n AS section_name_i18n,
        subject.code AS subject_code,
        subject.name_i18n AS subject_name_i18n,
        teacher.first_name AS teacher_first_name,
        teacher.last_name AS teacher_last_name,
        section_subject.created_at,
        section_subject.updated_at
      FROM section_subjects section_subject
      JOIN sections section
        ON section.id = section_subject.section_id
       AND section.school_id = section_subject.school_id
       AND section.deleted_at IS NULL
      JOIN subjects subject
        ON subject.id = section_subject.subject_id
       AND subject.deleted_at IS NULL
      JOIN teachers teacher
        ON teacher.id = section_subject.teacher_id
       AND teacher.deleted_at IS NULL
      WHERE section_subject.academic_year_id = $1
        AND section_subject.school_id = $2
        AND section_subject.deleted_at IS NULL
        AND ($3::uuid IS NULL OR section_subject.section_id = $3)
        AND (
          $4::boolean = FALSE
          OR EXISTS (
            SELECT 1
            FROM teacher_academic_assignments assignment
            JOIN school_subjects canonical_subject
              ON canonical_subject.id = assignment.subject_id
             AND canonical_subject.school_id = assignment.school_id
             AND canonical_subject.code = subject.code
             AND canonical_subject.deleted_at IS NULL
            JOIN school_staff_accounts staff
              ON staff.id = assignment.teacher_staff_account_id
             AND staff.school_id = assignment.school_id
             AND staff.user_id = $5
             AND staff.employment_status = 'ACTIVE'
             AND staff.deleted_at IS NULL
            WHERE assignment.school_id = section_subject.school_id
              AND assignment.academic_year_id =
                section_subject.academic_year_id
              AND assignment.section_id = section_subject.section_id
              AND assignment.assignment_status = 'ACTIVE'
              AND assignment.deleted_at IS NULL
          )
        )
      ORDER BY section.code, subject.code
      `,
      [
        academicYearId,
        year.school_id,
        sectionId ?? null,
        teacherScoped,
        actorUserId,
      ],
    );

    return result.rows;
  }
}
