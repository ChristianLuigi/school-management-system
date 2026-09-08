import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { AssignGradeLevelSubjectDto } from './dto/assign-grade-level-subject.dto';
import { ConfigureGradeLevelSectionsDto } from './dto/configure-grade-level-sections.dto';
import { CreateSchoolSubjectDto } from './dto/create-school-subject.dto';
import { QuickAcademicSetupDto } from './dto/quick-academic-setup.dto';

type AcademicYearRow = {
  id: string;
  school_id: string;
  name_i18n: Record<string, string>;
  start_date: string;
  end_date: string;
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED';
  created_at: string;
  updated_at: string;
};

type GradingPeriodRow = {
  id: string;
  academic_year_id: string;
  period_type: 'TRIMESTER';
  sequence_no: number;
  name_i18n: Record<string, string>;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

type GradeLevelRow = {
  id: string;
  school_id: string;
  code: string;
  name_i18n: Record<string, string>;
  display_order: number;
  academic_division: string | null;
  grading_configuration_id: string | null;
  created_at: string;
  updated_at: string;
};

type SectionRow = {
  id: string;
  school_id: string;
  academic_year_id: string;
  grade_level_id: string;
  code: string;
  name_i18n: Record<string, string>;
  homeroom_teacher_id: string | null;
  created_at: string;
  updated_at: string;
};

type SectionOptionRow = {
  id: string;
  code: string;
  name_i18n: Record<string, string> | null;
  grade_level_code: string | null;
  grade_level_name_i18n: Record<string, string> | null;
  academic_division: 'KINDERGARTEN' | 'PRIMARY' | 'SECONDARY' | null;
  grade_level_display_order: number | null;
  section_display_order: number | null;
  academic_year_id: string;
  academic_year_name_i18n: Record<string, string> | null;
  academic_year_status: 'ACTIVE' | 'PLANNED';
  capacity: number | null;
  room_label: string | null;
  active_enrollment_count: number;
};

@Injectable()
export class AcademicService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  private sectionLetter(index: number) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    return letters[index] ?? String(index + 1);
  }

  async assertUserCanAccessAcademicSetup(
    actorUserId: string,
    schoolId: string,
    platformRole: 'SUPER_ADMIN' | null,
    allowedRoles: string[],
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
      role: string;
    }>(
      `
      SELECT smr.role::text AS role
      FROM school_memberships sm
      JOIN school_membership_roles smr
        ON smr.school_membership_id = sm.id
       AND smr.deleted_at IS NULL
      WHERE sm.user_id = $1
        AND sm.school_id = $2
        AND sm.deleted_at IS NULL
        AND sm.membership_status = 'ACTIVE'
        AND EXISTS (
          SELECT 1
          FROM school_staff_accounts staff
          WHERE staff.school_id = sm.school_id
            AND staff.user_id = sm.user_id
            AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
            AND staff.deleted_at IS NULL
        )
      `,
      [actorUserId, schoolId],
    );

    const roles = membershipResult.rows.map((row) => row.role);
    const hasAllowedRole = roles.some((role) => allowedRoles.includes(role));

    if (!hasAllowedRole) {
      throw new ForbiddenException(
        'You do not have permission to manage academic setup.',
      );
    }
  }

  private async isAcademicAdministrator(
    actorUserId: string,
    schoolId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    if (platformRole === 'SUPER_ADMIN') return true;

    const result = await this.db.query(
      `
      SELECT sm.id
      FROM school_memberships sm
      JOIN school_membership_roles role
        ON role.school_membership_id = sm.id
       AND role.role = 'SCHOOL_ADMIN'
       AND role.deleted_at IS NULL
      WHERE sm.school_id = $1
        AND sm.user_id = $2
        AND sm.membership_status = 'ACTIVE'
        AND sm.deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId, actorUserId],
    );

    return Boolean(result.rowCount);
  }
  async listSchoolSubjects(
    schoolId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    const result = await this.db.query<{
      id: string;
      code: string;
      name_i18n: Record<string, string>;
      description: string | null;
      subject_active: boolean;
    }>(
      `
      SELECT id, code, name_i18n, description, subject_active
      FROM school_subjects
      WHERE school_id = $1
        AND deleted_at IS NULL
      ORDER BY code ASC
      `,
      [schoolId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameI18n: row.name_i18n,
      description: row.description,
      subjectActive: row.subject_active,
    }));
  }

  async createSchoolSubject(
    dto: CreateSchoolSubjectDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    const code = dto.code.trim().toUpperCase();
    const nameFr = dto.nameFr.trim();

    if (!code || !nameFr) {
      throw new BadRequestException(
        'Subject code and French name are required.',
      );
    }

    const result = await this.db.query<{
      id: string;
      code: string;
      name_i18n: Record<string, string>;
    }>(
      `
      INSERT INTO school_subjects (
        school_id,
        code,
        name_i18n,
        description
      )
      VALUES (
        $1::uuid,
        $2::text,
        jsonb_build_object('fr', $3::text, 'en', $4::text),
        $5::text
      )
      ON CONFLICT (school_id, code)
      DO UPDATE SET
        name_i18n = EXCLUDED.name_i18n,
        description = EXCLUDED.description,
        deleted_at = NULL,
        subject_active = TRUE,
        updated_at = NOW()
      RETURNING id, code, name_i18n
      `,
      [
        dto.schoolId,
        code,
        nameFr,
        dto.nameEn?.trim() || nameFr,
        dto.description?.trim() || null,
      ],
    );

    return {
      id: result.rows[0].id,
      code: result.rows[0].code,
      nameI18n: result.rows[0].name_i18n,
    };
  }

  async listGradeLevelSubjects(
    input: {
      schoolId: string;
      gradeLevelId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
    allowedRoles: string[] = ['SCHOOL_ADMIN'],
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      input.schoolId,
      platformRole,
      allowedRoles,
    );

    const result = await this.db.query<{
      id: string;
      subject_id: string;
      code: string;
      name_i18n: Record<string, string>;
      coefficient: string;
      display_order: number;
      is_required: boolean;
    }>(
      `
      SELECT
        gls.id,
        subj.id AS subject_id,
        subj.code,
        subj.name_i18n,
        gls.coefficient::text AS coefficient,
        gls.display_order,
        gls.is_required
      FROM grade_level_subjects gls
      JOIN school_subjects subj
        ON subj.id = gls.subject_id
       AND subj.deleted_at IS NULL
       AND subj.subject_active = TRUE
      WHERE gls.school_id = $1
        AND gls.grade_level_id = $2
        AND gls.deleted_at IS NULL
      ORDER BY gls.display_order ASC, subj.code ASC
      `,
      [input.schoolId, input.gradeLevelId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      subjectId: row.subject_id,
      code: row.code,
      nameI18n: row.name_i18n,
      coefficient: Number(row.coefficient),
      displayOrder: row.display_order,
      isRequired: row.is_required,
    }));
  }

  async listSectionSubjects(
    input: {
      schoolId: string;
      sectionId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const sectionResult = await this.db.query<{
      grade_level_id: string;
      academic_year_id: string;
    }>(
      `
      SELECT grade_level_id, academic_year_id
      FROM sections
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.sectionId, input.schoolId],
    );

    const section = sectionResult.rows[0];

    if (!section) {
      throw new NotFoundException('Section not found for this school.');
    }

    if (
      await this.isAcademicAdministrator(
        actorUserId,
        input.schoolId,
        platformRole,
      )
    ) {
      return this.listGradeLevelSubjects(
        {
          schoolId: input.schoolId,
          gradeLevelId: section.grade_level_id,
        },
        actorUserId,
        platformRole,
        ['SCHOOL_ADMIN', 'TEACHER'],
      );
    }

    const result = await this.db.query<{
      id: string;
      subject_id: string;
      code: string;
      name_i18n: Record<string, string>;
      coefficient: string;
      display_order: number;
      is_required: boolean;
    }>(
      `
      SELECT
        configured.id,
        subject.id AS subject_id,
        subject.code,
        subject.name_i18n,
        configured.coefficient::text AS coefficient,
        configured.display_order,
        configured.is_required
      FROM grade_level_subjects configured
      JOIN school_subjects subject
        ON subject.id = configured.subject_id
       AND subject.school_id = configured.school_id
       AND subject.subject_active = TRUE
       AND subject.deleted_at IS NULL
      WHERE configured.school_id = $1
        AND configured.grade_level_id = $2
        AND configured.deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM teacher_academic_assignments assignment
          JOIN school_staff_accounts staff
            ON staff.id = assignment.teacher_staff_account_id
           AND staff.school_id = assignment.school_id
           AND staff.user_id = $3
           AND staff.staff_category = 'TEACHING'
           AND staff.employment_status = 'ACTIVE'
           AND staff.deleted_at IS NULL
          WHERE assignment.school_id = configured.school_id
            AND assignment.academic_year_id = $4
            AND assignment.section_id = $5
            AND assignment.subject_id = configured.subject_id
            AND assignment.assignment_status = 'ACTIVE'
            AND assignment.deleted_at IS NULL
        )
      ORDER BY configured.display_order ASC, subject.code ASC
      `,
      [
        input.schoolId,
        section.grade_level_id,
        actorUserId,
        section.academic_year_id,
        input.sectionId,
      ],
    );

    if (!result.rows.length) {
      throw new ForbiddenException(
        'This section is not assigned to the teacher.',
      );
    }

    return result.rows.map((row) => ({
      id: row.id,
      subjectId: row.subject_id,
      code: row.code,
      nameI18n: row.name_i18n,
      coefficient: Number(row.coefficient),
      displayOrder: row.display_order,
      isRequired: row.is_required,
    }));
  }
  async assignGradeLevelSubject(
    gradeLevelId: string,
    dto: AssignGradeLevelSubjectDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    const result = await this.db.query<{
      id: string;
    }>(
      `
      INSERT INTO grade_level_subjects (
        school_id,
        grade_level_id,
        subject_id,
        coefficient,
        display_order,
        is_required
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (school_id, grade_level_id, subject_id)
      DO UPDATE SET
        coefficient = EXCLUDED.coefficient,
        display_order = EXCLUDED.display_order,
        is_required = EXCLUDED.is_required,
        deleted_at = NULL,
        updated_at = NOW()
      RETURNING id
      `,
      [
        dto.schoolId,
        gradeLevelId,
        dto.subjectId,
        dto.coefficient ?? 1,
        dto.displayOrder ?? 100,
        dto.isRequired ?? true,
      ],
    );

    return {
      id: result.rows[0].id,
      gradeLevelId,
      subjectId: dto.subjectId,
    };
  }
  async applyQuickAcademicSetup(
    dto: QuickAcademicSetupDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    const enabledGrades = dto.grades.filter((grade) => grade.enabled);

    if (enabledGrades.length === 0) {
      throw new BadRequestException('At least one class must be selected.');
    }

    return this.db.withTransaction(async (client) => {
      const academicYearResult = await client.query<{ id: string }>(
        `
        SELECT id
        FROM academic_years
        WHERE school_id = $1::uuid
          AND deleted_at IS NULL
        ORDER BY
          CASE status
            WHEN 'ACTIVE' THEN 1
            WHEN 'PLANNED' THEN 2
            ELSE 3
          END,
          start_date DESC
        LIMIT 1
        `,
        [dto.schoolId],
      );

      let academicYearId = academicYearResult.rows[0]?.id ?? null;

      if (!academicYearId) {
        const year = new Date().getFullYear();
        const createdYearResult = await client.query<{ id: string }>(
          `
          INSERT INTO academic_years (
            school_id,
            name_i18n,
            start_date,
            end_date,
            status
          )
          VALUES (
            $1::uuid,
            jsonb_build_object(
              'fr', $2::int::text || '-' || ($2::int + 1)::text,
              'en', $2::int::text || '-' || ($2::int + 1)::text
            ),
            make_date($2::int, 9, 1),
            make_date($2::int + 1, 7, 31),
            'ACTIVE'
          )
          RETURNING id
          `,
          [dto.schoolId, year],
        );

        academicYearId = createdYearResult.rows[0].id;
      }

      const createdGradeLevels: Array<{
        id: string;
        code: string;
        nameFr: string;
        sectionCount: number;
      }> = [];

      for (const grade of enabledGrades) {
        const gradeCode = grade.gradeCode.trim().toUpperCase();
        const nameFr = grade.nameFr.trim();
        const nameEn = grade.nameEn.trim() || nameFr;

        if (!gradeCode || !nameFr) {
          throw new BadRequestException('Grade code and name are required.');
        }

        const gradeResult = await client.query<{
          id: string;
          code: string;
        }>(
          `
          INSERT INTO grade_levels (
            school_id,
            code,
            name_i18n,
            academic_division,
            display_order
          )
          VALUES (
            $1::uuid,
            $2::text,
            jsonb_build_object('fr', $3::text, 'en', $4::text),
            $5::text,
            $6::int
          )
          ON CONFLICT ON CONSTRAINT uq_grade_level_code_per_school
          DO UPDATE SET
            name_i18n = EXCLUDED.name_i18n,
            academic_division = EXCLUDED.academic_division,
            display_order = EXCLUDED.display_order,
            deleted_at = NULL,
            updated_at = NOW()
          RETURNING id, code
          `,
          [
            dto.schoolId,
            gradeCode,
            nameFr,
            nameEn,
            grade.academicDivision,
            grade.displayOrder,
          ],
        );

        const gradeLevel = gradeResult.rows[0];

        createdGradeLevels.push({
          id: gradeLevel.id,
          code: gradeLevel.code,
          nameFr,
          sectionCount: grade.sectionCount,
        });

        for (let index = 1; index <= grade.sectionCount; index += 1) {
          const letterResult = await client.query<{ letter: string }>(
            `
            SELECT section_letter_from_number($1::int) AS letter
            `,
            [index],
          );

          const letter = letterResult.rows[0].letter;
          const sectionCode = `${gradeCode}-${letter}`;
          const sectionNameFr = `${nameFr} - ${letter}`;
          const sectionNameEn = `${nameEn} - ${letter}`;

          await client.query(
            `
            INSERT INTO sections (
              school_id,
              academic_year_id,
              grade_level_id,
              code,
              name_i18n,
              display_order
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              $3::uuid,
              $4::text,
              jsonb_build_object('fr', $5::text, 'en', $6::text),
              $7::int
            )
            ON CONFLICT ON CONSTRAINT uq_section_per_grade_year
            DO UPDATE SET
              name_i18n = EXCLUDED.name_i18n,
              display_order = EXCLUDED.display_order,
              deleted_at = NULL,
              updated_at = NOW()
            `,
            [
              dto.schoolId,
              academicYearId,
              gradeLevel.id,
              sectionCode,
              sectionNameFr,
              sectionNameEn,
              index,
            ],
          );
        }
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'ACADEMIC_QUICK_SETUP_APPLIED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Academic quick setup applied with ${enabledGrades.length} grade levels.`,
        payload: {
          academicYearId,
          gradeCount: enabledGrades.length,
          grades: createdGradeLevels,
        },
      });

      return {
        schoolId: dto.schoolId,
        academicYearId,
        gradeCount: enabledGrades.length,
        sectionCount: createdGradeLevels.reduce(
          (sum, grade) => sum + grade.sectionCount,
          0,
        ),
        grades: createdGradeLevels,
      };
    });
  }
  async ensureHaitianStructure(
    input: {
      schoolId: string;
      includeKindergarten?: boolean;
      includePrimary?: boolean;
      includeSecondary?: boolean;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    const divisions: string[] = [];

    if (input.includeKindergarten) {
      divisions.push('KINDERGARTEN');
    }

    if (input.includePrimary) {
      divisions.push('PRIMARY');
    }

    if (input.includeSecondary) {
      divisions.push('SECONDARY');
    }

    if (divisions.length === 0) {
      throw new BadRequestException(
        'At least one academic division must be selected.',
      );
    }

    await this.db.withTransaction(async (client) => {
      await client.query(
        `
        SELECT ensure_haitian_academic_structure_for_divisions($1, $2::text[])
        `,
        [input.schoolId, divisions],
      );

      await client.query(
        `
        INSERT INTO school_academic_structure_settings (
          school_id,
          include_kindergarten,
          include_primary,
          include_secondary,
          structure_mode,
          configured_at,
          configured_by_user_id
        )
        VALUES ($1, $2, $3, $4, 'HAITIAN_STANDARD', NOW(), $5)
        ON CONFLICT (school_id)
        DO UPDATE SET
          include_kindergarten = EXCLUDED.include_kindergarten,
          include_primary = EXCLUDED.include_primary,
          include_secondary = EXCLUDED.include_secondary,
          structure_mode = EXCLUDED.structure_mode,
          configured_at = NOW(),
          configured_by_user_id = EXCLUDED.configured_by_user_id,
          updated_at = NOW()
        `,
        [
          input.schoolId,
          Boolean(input.includeKindergarten),
          Boolean(input.includePrimary),
          Boolean(input.includeSecondary),
          actorUserId,
        ],
      );
    });

    return {
      schoolId: input.schoolId,
      selectedDivisions: divisions,
      message: 'Academic structure created or updated successfully.',
    };
  }

  async findAcademicYears(schoolId: string): Promise<AcademicYearRow[]> {
    const result = await this.db.query<AcademicYearRow>(
      `
      SELECT
        id,
        school_id,
        name_i18n,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
      FROM academic_years
      WHERE school_id = $1
        AND deleted_at IS NULL
      ORDER BY start_date DESC
      `,
      [schoolId],
    );

    return result.rows;
  }

  async findGradingPeriods(
    academicYearId: string,
  ): Promise<GradingPeriodRow[]> {
    const result = await this.db.query<GradingPeriodRow>(
      `
      SELECT
        id,
        academic_year_id,
        period_type,
        sequence_no,
        name_i18n,
        start_date,
        end_date,
        is_current,
        created_at,
        updated_at
      FROM grading_periods
      WHERE academic_year_id = $1
        AND deleted_at IS NULL
      ORDER BY sequence_no ASC
      `,
      [academicYearId],
    );

    return result.rows;
  }

  async findGradeLevels(schoolId: string): Promise<GradeLevelRow[]> {
    const result = await this.db.query<GradeLevelRow>(
      `
      SELECT
        id,
        school_id,
        code,
        name_i18n,
        display_order,
        academic_division,
        grading_configuration_id,
        created_at,
        updated_at
      FROM grade_levels
      WHERE school_id = $1
        AND deleted_at IS NULL
      ORDER BY display_order ASC, code ASC
      `,
      [schoolId],
    );

    return result.rows;
  }

  async getAcademicOverview(
    schoolId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const administratorResult = await this.db.query(
      `
      SELECT sm.id
      FROM school_memberships sm
      JOIN school_membership_roles role
        ON role.school_membership_id = sm.id
       AND role.role = 'SCHOOL_ADMIN'
       AND role.deleted_at IS NULL
      WHERE sm.school_id = $1
        AND sm.user_id = $2
        AND sm.membership_status = 'ACTIVE'
        AND sm.deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId, actorUserId],
    );
    const administratorView =
      platformRole === 'SUPER_ADMIN' || Boolean(administratorResult.rowCount);
    const teacherUserId = administratorView ? null : actorUserId;

    const yearResult = await this.db.query<{
      id: string;
      name_i18n: Record<string, string>;
      start_date: string;
      end_date: string;
      status: 'ACTIVE' | 'PLANNED';
    }>(
      `
      SELECT
        id,
        name_i18n,
        start_date::text,
        end_date::text,
        status::text
      FROM academic_years
      WHERE school_id = $1
        AND status IN ('ACTIVE', 'PLANNED')
        AND deleted_at IS NULL
      ORDER BY
        CASE status WHEN 'ACTIVE' THEN 1 ELSE 2 END,
        start_date DESC
      LIMIT 1
      `,
      [schoolId],
    );
    const year = yearResult.rows[0];

    if (!year) {
      return {
        viewMode: administratorView ? 'ADMINISTRATOR' : 'TEACHER',
        academicYear: null,
        metrics: {
          sectionCount: 0,
          studentCount: 0,
          assignmentCount: 0,
          subjectCoveragePercent: 0,
        },
        readiness: {
          sectionsAtCapacity: 0,
          sectionsWithoutCapacity: 0,
          unassignedSubjectSlots: 0,
          studentsWithoutPlacement: 0,
        },
        sections: [],
        assignments: [],
      };
    }

    const sectionsResult = await this.db.query<{
      id: string;
      code: string;
      name_i18n: Record<string, string> | null;
      room_label: string | null;
      capacity: number | null;
      grade_level_id: string;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string> | null;
      academic_division: string | null;
      active_enrollment_count: string;
      required_subject_count: string;
      assigned_subject_count: string;
    }>(
      `
      SELECT
        section.id,
        section.code,
        section.name_i18n,
        section.room_label,
        section.capacity,
        grade.id AS grade_level_id,
        grade.code AS grade_level_code,
        grade.name_i18n AS grade_level_name_i18n,
        grade.academic_division,
        (
          SELECT COUNT(*)::text
          FROM enrollments enrollment
          WHERE enrollment.section_id = section.id
            AND enrollment.enrollment_status = 'ACTIVE'
            AND enrollment.deleted_at IS NULL
        ) AS active_enrollment_count,
        (
          SELECT COUNT(*)::text
          FROM grade_level_subjects configured
          WHERE configured.school_id = section.school_id
            AND configured.grade_level_id = section.grade_level_id
            AND configured.deleted_at IS NULL
        ) AS required_subject_count,
        (
          SELECT COUNT(DISTINCT assignment.subject_id)::text
          FROM teacher_academic_assignments assignment
          JOIN school_staff_accounts staff
            ON staff.id = assignment.teacher_staff_account_id
           AND staff.school_id = assignment.school_id
           AND staff.employment_status = 'ACTIVE'
           AND staff.deleted_at IS NULL
          WHERE assignment.school_id = section.school_id
            AND assignment.academic_year_id = section.academic_year_id
            AND assignment.section_id = section.id
            AND assignment.assignment_status = 'ACTIVE'
            AND assignment.deleted_at IS NULL
            AND ($3::uuid IS NULL OR staff.user_id = $3)
        ) AS assigned_subject_count
      FROM sections section
      JOIN grade_levels grade
        ON grade.id = section.grade_level_id
       AND grade.school_id = section.school_id
       AND grade.deleted_at IS NULL
      WHERE section.school_id = $1
        AND section.academic_year_id = $2
        AND section.deleted_at IS NULL
        AND (
          $3::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM teacher_academic_assignments assignment
            JOIN school_staff_accounts staff
              ON staff.id = assignment.teacher_staff_account_id
             AND staff.school_id = assignment.school_id
             AND staff.user_id = $3
             AND staff.employment_status = 'ACTIVE'
             AND staff.deleted_at IS NULL
            WHERE assignment.school_id = section.school_id
              AND assignment.academic_year_id = section.academic_year_id
              AND assignment.section_id = section.id
              AND assignment.assignment_status = 'ACTIVE'
              AND assignment.deleted_at IS NULL
          )
        )
      ORDER BY
        COALESCE(grade.display_order, 9999),
        COALESCE(section.display_order, 9999),
        section.code
      `,
      [schoolId, year.id, teacherUserId],
    );

    const assignmentsResult = await this.db.query<{
      id: string;
      section_id: string;
      section_code: string;
      subject_id: string;
      subject_code: string;
      subject_name_i18n: Record<string, string> | null;
      teacher_staff_account_id: string;
      teacher_name: string;
    }>(
      `
      SELECT
        assignment.id,
        section.id AS section_id,
        section.code AS section_code,
        subject.id AS subject_id,
        subject.code AS subject_code,
        subject.name_i18n AS subject_name_i18n,
        staff.id AS teacher_staff_account_id,
        COALESCE(
          NULLIF(BTRIM(staff.preferred_name), ''),
          NULLIF(BTRIM(CONCAT_WS(' ', staff.first_name, staff.last_name)), ''),
          NULLIF(BTRIM(CONCAT_WS(' ', account.first_name, account.last_name)), ''),
          staff.staff_code,
          'Teacher'
        ) AS teacher_name
      FROM teacher_academic_assignments assignment
      JOIN sections section
        ON section.id = assignment.section_id
       AND section.school_id = assignment.school_id
       AND section.deleted_at IS NULL
      JOIN school_subjects subject
        ON subject.id = assignment.subject_id
       AND subject.school_id = assignment.school_id
       AND subject.deleted_at IS NULL
      JOIN school_staff_accounts staff
        ON staff.id = assignment.teacher_staff_account_id
       AND staff.school_id = assignment.school_id
       AND staff.employment_status = 'ACTIVE'
       AND staff.deleted_at IS NULL
      LEFT JOIN users account
        ON account.id = staff.user_id
       AND account.deleted_at IS NULL
      WHERE assignment.school_id = $1
        AND assignment.academic_year_id = $2
        AND assignment.assignment_status = 'ACTIVE'
        AND assignment.deleted_at IS NULL
        AND ($3::uuid IS NULL OR staff.user_id = $3)
      ORDER BY section.code, subject.code, teacher_name
      `,
      [schoolId, year.id, teacherUserId],
    );

    let studentsWithoutPlacement = 0;

    if (administratorView) {
      const unplacedResult = await this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM students student
        WHERE student.school_id = $1
          AND student.status IN ('REGISTERED', 'ACTIVE')
          AND student.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM enrollments enrollment
            WHERE enrollment.student_id = student.id
              AND enrollment.enrollment_status = 'ACTIVE'
              AND enrollment.deleted_at IS NULL
          )
        `,
        [schoolId],
      );
      studentsWithoutPlacement = Number(unplacedResult.rows[0]?.count ?? 0);
    }

    const sections = sectionsResult.rows.map((row) => {
      const studentCount = Number(row.active_enrollment_count);
      const capacity = row.capacity === null ? null : Number(row.capacity);
      const assignedSubjectCount = Number(row.assigned_subject_count);
      const configuredSubjectCount = administratorView
        ? Number(row.required_subject_count)
        : assignedSubjectCount;

      return {
        id: row.id,
        code: row.code,
        nameI18n: row.name_i18n,
        roomLabel: row.room_label,
        capacity,
        studentCount,
        availableSeats:
          capacity === null ? null : Math.max(capacity - studentCount, 0),
        atCapacity: capacity !== null && studentCount >= capacity,
        gradeLevel: {
          id: row.grade_level_id,
          code: row.grade_level_code,
          nameI18n: row.grade_level_name_i18n,
          academicDivision: row.academic_division,
        },
        configuredSubjectCount,
        assignedSubjectCount,
      };
    });
    const configuredSubjectSlots = sections.reduce(
      (sum, section) => sum + section.configuredSubjectCount,
      0,
    );
    const assignedSubjectSlots = sections.reduce(
      (sum, section) => sum + section.assignedSubjectCount,
      0,
    );

    return {
      viewMode: administratorView ? 'ADMINISTRATOR' : 'TEACHER',
      academicYear: {
        id: year.id,
        nameI18n: year.name_i18n,
        startDate: year.start_date,
        endDate: year.end_date,
        status: year.status,
      },
      metrics: {
        sectionCount: sections.length,
        studentCount: sections.reduce(
          (sum, section) => sum + section.studentCount,
          0,
        ),
        assignmentCount: assignmentsResult.rows.length,
        subjectCoveragePercent:
          configuredSubjectSlots > 0
            ? Math.round((assignedSubjectSlots / configuredSubjectSlots) * 100)
            : 0,
      },
      readiness: {
        sectionsAtCapacity: sections.filter((section) => section.atCapacity)
          .length,
        sectionsWithoutCapacity: sections.filter(
          (section) => section.capacity === null,
        ).length,
        unassignedSubjectSlots: administratorView
          ? Math.max(configuredSubjectSlots - assignedSubjectSlots, 0)
          : 0,
        studentsWithoutPlacement,
      },
      sections,
      assignments: assignmentsResult.rows.map((row) => ({
        id: row.id,
        sectionId: row.section_id,
        sectionCode: row.section_code,
        subjectId: row.subject_id,
        subjectCode: row.subject_code,
        subjectNameI18n: row.subject_name_i18n,
        teacherStaffAccountId: row.teacher_staff_account_id,
        teacherName: row.teacher_name,
      })),
    };
  }
  async findSectionOptions(
    schoolId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );
    const teacherUserId = (await this.isAcademicAdministrator(
      actorUserId,
      schoolId,
      platformRole,
    ))
      ? null
      : actorUserId;
    const result = await this.db.query<SectionOptionRow>(
      `
      SELECT
        se.id,
        se.code,
        se.name_i18n,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n,
        gl.academic_division,
        gl.display_order AS grade_level_display_order,
        se.display_order AS section_display_order,
        ay.id AS academic_year_id,
        ay.name_i18n AS academic_year_name_i18n,
        ay.status::text AS academic_year_status,
        se.capacity,
        se.room_label,
        (
          SELECT COUNT(*)::int
          FROM enrollments en
          WHERE en.section_id = se.id
            AND en.enrollment_status = 'ACTIVE'
            AND en.deleted_at IS NULL
        ) AS active_enrollment_count
      FROM sections se
      JOIN grade_levels gl
        ON gl.id = se.grade_level_id
       AND gl.school_id = se.school_id
       AND gl.deleted_at IS NULL
      JOIN academic_years ay
        ON ay.id = se.academic_year_id
       AND ay.school_id = se.school_id
       AND ay.deleted_at IS NULL
      WHERE se.school_id = $1
        AND se.deleted_at IS NULL
        AND (
          $2::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM teacher_academic_assignments assignment
            JOIN school_staff_accounts staff
              ON staff.id = assignment.teacher_staff_account_id
             AND staff.school_id = assignment.school_id
             AND staff.user_id = $2
             AND staff.staff_category = 'TEACHING'
             AND staff.employment_status = 'ACTIVE'
             AND staff.deleted_at IS NULL
            WHERE assignment.school_id = se.school_id
              AND assignment.academic_year_id = se.academic_year_id
              AND assignment.section_id = se.id
              AND assignment.assignment_status = 'ACTIVE'
              AND assignment.deleted_at IS NULL
          )
        )
        AND ay.status IN ('ACTIVE', 'PLANNED')
      ORDER BY
        CASE ay.status WHEN 'ACTIVE' THEN 1 ELSE 2 END,
        ay.start_date DESC,
        COALESCE(gl.display_order, 9999),
        COALESCE(se.display_order, 9999),
        se.code ASC
      `,
      [schoolId, teacherUserId],
    );

    return result.rows.map((row) => {
      const capacity = row.capacity === null ? null : Number(row.capacity);
      const activeEnrollmentCount = Number(row.active_enrollment_count ?? 0);

      return {
        id: row.id,
        code: row.code,
        nameI18n: row.name_i18n,
        gradeLevelCode: row.grade_level_code,
        gradeLevelNameI18n: row.grade_level_name_i18n,
        academicDivision: row.academic_division,
        gradeLevelDisplayOrder: Number(row.grade_level_display_order ?? 9999),
        sectionDisplayOrder: Number(row.section_display_order ?? 9999),
        academicYearId: row.academic_year_id,
        academicYearNameI18n: row.academic_year_name_i18n,
        academicYearStatus: row.academic_year_status,
        capacity,
        roomLabel: row.room_label,
        activeEnrollmentCount,
        availableSeats:
          capacity === null
            ? null
            : Math.max(capacity - activeEnrollmentCount, 0),
        atCapacity: capacity !== null && activeEnrollmentCount >= capacity,
      };
    });
  }

  async configureGradeLevelSectionCount(
    gradeLevelId: string,
    dto: ConfigureGradeLevelSectionsDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    return this.db.withTransaction(async (client) => {
      const gradeResult = await client.query<{
        id: string;
        code: string;
        name_i18n: Record<string, string> | null;
      }>(
        `
        SELECT id, code, name_i18n
        FROM grade_levels
        WHERE id = $1::uuid
          AND school_id = $2::uuid
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [gradeLevelId, dto.schoolId],
      );

      const grade = gradeResult.rows[0];

      if (!grade) {
        throw new NotFoundException('Grade level not found for this school.');
      }

      const academicYearResult = await client.query<{ id: string }>(
        `
        SELECT id
        FROM academic_years
        WHERE school_id = $1::uuid
          AND deleted_at IS NULL
        ORDER BY
          CASE status
            WHEN 'ACTIVE' THEN 1
            WHEN 'PLANNED' THEN 2
            ELSE 3
          END,
          start_date DESC
        LIMIT 1
        `,
        [dto.schoolId],
      );

      let academicYearId = academicYearResult.rows[0]?.id ?? null;

      if (!academicYearId) {
        const year = new Date().getFullYear();
        const createdYearResult = await client.query<{ id: string }>(
          `
          INSERT INTO academic_years (
            school_id,
            name_i18n,
            start_date,
            end_date,
            status
          )
          VALUES (
            $1::uuid,
            jsonb_build_object(
              'fr', $2::int::text || '-' || ($2::int + 1)::text,
              'en', $2::int::text || '-' || ($2::int + 1)::text
            ),
            make_date($2::int, 9, 1),
            make_date($2::int + 1, 7, 31),
            'ACTIVE'
          )
          RETURNING id
          `,
          [dto.schoolId, year],
        );

        academicYearId = createdYearResult.rows[0].id;
      }

      const existingSectionsResult = await client.query<{
        id: string;
        code: string;
        display_order: number;
        active_enrollments: string;
      }>(
        `
        SELECT
          se.id,
          se.code,
          se.display_order,
          (
            SELECT COUNT(*)::text
            FROM enrollments en
            WHERE en.section_id = se.id
              AND en.deleted_at IS NULL
              AND en.enrollment_status = 'ACTIVE'
          ) AS active_enrollments
        FROM sections se
        WHERE se.school_id = $1::uuid
          AND se.academic_year_id = $2::uuid
          AND se.grade_level_id = $3::uuid
          AND se.deleted_at IS NULL
        ORDER BY se.display_order ASC, se.code ASC
        `,
        [dto.schoolId, academicYearId, gradeLevelId],
      );

      const existingSections = existingSectionsResult.rows;
      const gradeNameFr =
        grade.name_i18n?.fr ?? grade.name_i18n?.en ?? grade.code;
      const gradeNameEn =
        grade.name_i18n?.en ?? grade.name_i18n?.fr ?? grade.code;
      const createdOrUpdated: Array<{
        id: string;
        code: string;
        nameFr: string;
      }> = [];

      for (let index = 0; index < dto.sectionCount; index += 1) {
        const letter = this.sectionLetter(index);
        const sectionCode = `${grade.code}-${letter}`;
        const sectionNameFr = `${gradeNameFr} - ${letter}`;
        const sectionNameEn = `${gradeNameEn} - ${letter}`;

        const sectionResult = await client.query<{
          id: string;
          code: string;
        }>(
          `
          INSERT INTO sections (
            school_id,
            academic_year_id,
            grade_level_id,
            code,
            name_i18n,
            display_order
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::text,
            jsonb_build_object('fr', $5::text, 'en', $6::text),
            $7::int
          )
          ON CONFLICT ON CONSTRAINT uq_section_per_grade_year
          DO UPDATE SET
            name_i18n = EXCLUDED.name_i18n,
            display_order = EXCLUDED.display_order,
            deleted_at = NULL,
            updated_at = NOW()
          RETURNING id, code
          `,
          [
            dto.schoolId,
            academicYearId,
            gradeLevelId,
            sectionCode,
            sectionNameFr,
            sectionNameEn,
            index + 1,
          ],
        );

        createdOrUpdated.push({
          id: sectionResult.rows[0].id,
          code: sectionResult.rows[0].code,
          nameFr: sectionNameFr,
        });
      }

      const sectionsToRemove = existingSections.slice(dto.sectionCount);
      const archived: string[] = [];
      const blocked: Array<{
        sectionId: string;
        code: string;
        reason: string;
      }> = [];

      for (const section of sectionsToRemove) {
        const activeEnrollments = Number(section.active_enrollments);

        if (activeEnrollments > 0) {
          blocked.push({
            sectionId: section.id,
            code: section.code,
            reason: `${activeEnrollments} active student(s) still assigned.`,
          });
          continue;
        }

        await client.query(
          `
          UPDATE sections
          SET deleted_at = NOW(),
              updated_at = NOW()
          WHERE id = $1::uuid
            AND school_id = $2::uuid
            AND deleted_at IS NULL
          `,
          [section.id, dto.schoolId],
        );

        archived.push(section.code);
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'GRADE_LEVEL_SECTIONS_CONFIGURED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Configured ${dto.sectionCount} section(s) for ${gradeNameFr}.`,
        payload: {
          academicYearId,
          gradeLevelId,
          sectionCount: dto.sectionCount,
          createdOrUpdated,
          archived,
          blocked,
        },
      });

      return {
        gradeLevelId,
        gradeCode: grade.code,
        gradeName: gradeNameFr,
        requestedSectionCount: dto.sectionCount,
        activeSectionCount: createdOrUpdated.length,
        sections: createdOrUpdated,
        archived,
        blocked,
      };
    });
  }
  async configureGradeLevelSections(
    input: {
      schoolId: string;
      gradeLevelId: string;
      numberOfSections: number;
      defaultCapacity?: number;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessAcademicSetup(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    if (
      !Number.isInteger(input.numberOfSections) ||
      input.numberOfSections < 1
    ) {
      throw new BadRequestException('Number of sections must be at least 1.');
    }

    if (input.numberOfSections > 26) {
      throw new BadRequestException(
        'For now, please limit automatic section creation to 26 sections per class.',
      );
    }

    return this.db.withTransaction(async (client) => {
      const gradeLevelResult = await client.query<{
        id: string;
        code: string;
        name_i18n: Record<string, string> | null;
      }>(
        `
        SELECT id, code, name_i18n
        FROM grade_levels
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [input.gradeLevelId, input.schoolId],
      );

      const gradeLevel = gradeLevelResult.rows[0];

      if (!gradeLevel) {
        throw new NotFoundException('Grade level not found for this school.');
      }

      let academicYearId: string | null = null;

      const academicYearResult = await client.query<{ id: string }>(
        `
        SELECT id
        FROM academic_years
        WHERE school_id = $1::uuid
          AND deleted_at IS NULL
        ORDER BY
          CASE status
            WHEN 'ACTIVE' THEN 1
            WHEN 'PLANNED' THEN 2
            ELSE 3
          END,
          start_date DESC
        LIMIT 1
        `,
        [input.schoolId],
      );

      academicYearId = academicYearResult.rows[0]?.id ?? null;

      if (!academicYearId) {
        const year = new Date().getFullYear();
        const createdYearResult = await client.query<{ id: string }>(
          `
          INSERT INTO academic_years (
            school_id,
            name_i18n,
            start_date,
            end_date,
            status
          )
          VALUES (
            $1::uuid,
            jsonb_build_object(
              'fr', $2::int::text || '-' || ($2::int + 1)::text,
              'en', $2::int::text || '-' || ($2::int + 1)::text
            ),
            make_date($2::int, 9, 1),
            make_date($2::int + 1, 7, 31),
            'ACTIVE'
          )
          RETURNING id
          `,
          [input.schoolId, year],
        );

        academicYearId = createdYearResult.rows[0].id;
      }

      const gradeNameFr =
        gradeLevel.name_i18n?.fr ?? gradeLevel.name_i18n?.en ?? gradeLevel.code;

      const gradeNameEn =
        gradeLevel.name_i18n?.en ?? gradeLevel.name_i18n?.fr ?? gradeLevel.code;

      const createdOrUpdatedSections: Array<{
        id: string;
        code: string;
        nameI18n: Record<string, string>;
        displayOrder: number;
        capacity: number | null;
      }> = [];

      for (let index = 1; index <= input.numberOfSections; index += 1) {
        const letterResult = await client.query<{ letter: string }>(
          `
          SELECT section_letter_from_number($1::int) AS letter
          `,
          [index],
        );

        const letter = letterResult.rows[0].letter;
        const sectionCode = `${gradeLevel.code}-${letter}`;
        const sectionNameFr = `${gradeNameFr} - Section ${letter}`;
        const sectionNameEn = `${gradeNameEn} - Section ${letter}`;

        const sectionResult = await client.query<{
          id: string;
          code: string;
          name_i18n: Record<string, string>;
          display_order: number;
          capacity: number | null;
        }>(
          `
          INSERT INTO sections (
            school_id,
            academic_year_id,
            grade_level_id,
            code,
            name_i18n,
            display_order,
            capacity
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            jsonb_build_object('fr', $5, 'en', $6),
            $7,
            $8
          )
          ON CONFLICT ON CONSTRAINT uq_section_per_grade_year
          DO UPDATE SET
            name_i18n = EXCLUDED.name_i18n,
            display_order = EXCLUDED.display_order,
            capacity = COALESCE(sections.capacity, EXCLUDED.capacity),
            deleted_at = NULL,
            updated_at = NOW()
          RETURNING
            id,
            code,
            name_i18n,
            display_order,
            capacity
          `,
          [
            input.schoolId,
            academicYearId,
            input.gradeLevelId,
            sectionCode,
            sectionNameFr,
            sectionNameEn,
            index,
            input.defaultCapacity ?? null,
          ],
        );

        const section = sectionResult.rows[0];

        if (section) {
          createdOrUpdatedSections.push({
            id: section.id,
            code: section.code,
            nameI18n: section.name_i18n,
            displayOrder: section.display_order,
            capacity: section.capacity,
          });
        }
      }

      return {
        gradeLevelId: input.gradeLevelId,
        numberOfSections: input.numberOfSections,
        sections: createdOrUpdatedSections,
      };
    });
  }

  async findSections(
    academicYearId: string,
    gradeLevelId?: string,
  ): Promise<SectionRow[]> {
    const hasGradeLevelFilter = Boolean(gradeLevelId);

    const result = await this.db.query<SectionRow>(
      `
      SELECT
        id,
        school_id,
        academic_year_id,
        grade_level_id,
        code,
        name_i18n,
        homeroom_teacher_id,
        created_at,
        updated_at
      FROM sections
      WHERE academic_year_id = $1
        AND deleted_at IS NULL
        ${hasGradeLevelFilter ? 'AND grade_level_id = $2' : ''}
      ORDER BY code ASC
      `,
      hasGradeLevelFilter ? [academicYearId, gradeLevelId] : [academicYearId],
    );

    return result.rows;
  }
}
