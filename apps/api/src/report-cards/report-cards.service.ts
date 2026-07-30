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
import { GenerateReportCardsDto } from './dto/generate-report-cards.dto';
import { UpdateReportCardCommentsDto } from './dto/update-report-card-comments.dto';

type ReportCardSubjectLine = {
  section_subject_id: string;
  subject_code: string;
  subject_name_i18n: Record<string, string>;
  coefficient: string;
  subject_average: string;
  passing_mark: string;
};

type ReportCardPreview = {
  student: {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
  };
  academic: {
    academicYearId: string;
    academicYearNameI18n: Record<string, string>;
    gradingPeriodId: string;
    gradingPeriodNameI18n: Record<string, string>;
    sectionId: string;
    sectionCode: string;
    sectionNameI18n: Record<string, string>;
    gradeLevelId: string;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string>;
  };
  summary: {
    overallAverage: number | null;
    rankInSection: number | null;
    attendance: {
      present: number;
      absent: number;
      late: number;
      excused: number;
    };
  };
  coverage: {
    totalSectionSubjects: number;
    approvedGradebooks: number;
    isComplete: boolean;
  };
  subjects: ReportCardSubjectLine[];
};

type ReportCardRow = {
  id: string;
  student_id: string;
  section_id: string;
  grading_period_id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
  overall_average: string | null;
  rank_in_section: number | null;
  attendance_summary: Record<string, number> | null;
  conduct_label_i18n: Record<string, string> | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReportCardItemRow = {
  id: string;
  report_card_id: string;
  section_subject_id: string;
  subject_name_snapshot_i18n: Record<string, string>;
  coefficient: string;
  subject_average: string;
  passing_mark: string;
  teacher_comment_i18n: Record<string, string> | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class ReportCardsService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  async findOne(studentId: string, gradingPeriodId: string) {
    const reportCardResult = await this.db.query<ReportCardRow>(
      `
        SELECT
          id,
          student_id,
          section_id,
          grading_period_id,
          status,
          overall_average,
          rank_in_section,
          attendance_summary,
          conduct_label_i18n,
          published_at,
          created_at,
          updated_at
        FROM report_cards
        WHERE student_id = $1
          AND grading_period_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
      [studentId, gradingPeriodId],
    );

    const reportCard = reportCardResult.rows[0] ?? null;

    if (!reportCard) {
      return null;
    }

    const itemsResult = await this.db.query<ReportCardItemRow>(
      `
        SELECT
          id,
          report_card_id,
          section_subject_id,
          subject_name_snapshot_i18n,
          coefficient,
          subject_average,
          passing_mark,
          teacher_comment_i18n,
          created_at,
          updated_at
        FROM report_card_items
        WHERE report_card_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        `,
      [reportCard.id],
    );

    return {
      reportCard,
      items: itemsResult.rows,
    };
  }

  async preview(
    studentId: string,
    gradingPeriodId: string,
  ): Promise<ReportCardPreview> {
    const studentAcademicContext = await this.getStudentAcademicContext(
      studentId,
      gradingPeriodId,
    );

    const attendanceResult = await this.db.query<{
      present_count: string;
      absent_count: string;
      late_count: string;
      excused_count: string;
    }>(
      `
        SELECT
          present_count,
          absent_count,
          late_count,
          excused_count
        FROM v_student_attendance_summary
        WHERE student_id = $1
          AND grading_period_id = $2
        LIMIT 1
        `,
      [studentId, gradingPeriodId],
    );

    const rankResult = await this.db.query<{
      trimester_average: string;
      rank_in_section: number;
    }>(
      `
        SELECT
          trimester_average,
          rank_in_section
        FROM v_student_trimester_ranks
        WHERE student_id = $1
          AND grading_period_id = $2
          AND section_id = $3
        LIMIT 1
        `,
      [studentId, gradingPeriodId, studentAcademicContext.section_id],
    );

    const subjectsResult = await this.db.query<ReportCardSubjectLine>(
      `
        SELECT
          v.section_subject_id,
          sub.code AS subject_code,
          sub.name_i18n AS subject_name_i18n,
          v.coefficient,
          v.subject_average,
          v.resolved_passing_score AS passing_mark
        FROM v_student_subject_term_averages v
        JOIN gradebooks gb ON gb.id = v.gradebook_id
        JOIN section_subjects ss ON ss.id = v.section_subject_id
        JOIN subjects sub ON sub.id = ss.subject_id
        WHERE v.student_id = $1
          AND v.grading_period_id = $2
          AND gb.status = 'APPROVED'
          AND gb.deleted_at IS NULL
          AND ss.deleted_at IS NULL
          AND sub.deleted_at IS NULL
        ORDER BY sub.code ASC
        `,
      [studentId, gradingPeriodId],
    );

    const coverageResult = await this.db.query<{
      total_section_subjects: string;
      approved_gradebooks: string;
    }>(
      `
        SELECT
          COUNT(ss.id)::text AS total_section_subjects,
          COUNT(gb.id) FILTER (WHERE gb.status = 'APPROVED')::text AS approved_gradebooks
        FROM section_subjects ss
        LEFT JOIN gradebooks gb
          ON gb.section_subject_id = ss.id
         AND gb.grading_period_id = $1
         AND gb.deleted_at IS NULL
        WHERE ss.section_id = $2
          AND ss.academic_year_id = $3
          AND ss.is_active = TRUE
          AND ss.deleted_at IS NULL
        `,
      [
        gradingPeriodId,
        studentAcademicContext.section_id,
        studentAcademicContext.academic_year_id,
      ],
    );

    const attendance = attendanceResult.rows[0];
    const rank = rankResult.rows[0];
    const coverage = coverageResult.rows[0];

    const totalSectionSubjects = Number(coverage?.total_section_subjects ?? 0);
    const approvedGradebooks = Number(coverage?.approved_gradebooks ?? 0);

    return {
      student: {
        id: studentAcademicContext.student_id,
        studentNumber: studentAcademicContext.student_number,
        firstName: studentAcademicContext.student_first_name,
        lastName: studentAcademicContext.student_last_name,
      },
      academic: {
        academicYearId: studentAcademicContext.academic_year_id,
        academicYearNameI18n: studentAcademicContext.academic_year_name_i18n,
        gradingPeriodId: studentAcademicContext.grading_period_id,
        gradingPeriodNameI18n: studentAcademicContext.grading_period_name_i18n,
        sectionId: studentAcademicContext.section_id,
        sectionCode: studentAcademicContext.section_code,
        sectionNameI18n: studentAcademicContext.section_name_i18n,
        gradeLevelId: studentAcademicContext.grade_level_id,
        gradeLevelCode: studentAcademicContext.grade_level_code,
        gradeLevelNameI18n: studentAcademicContext.grade_level_name_i18n,
      },
      summary: {
        overallAverage: rank ? Number(rank.trimester_average) : null,
        rankInSection: rank ? rank.rank_in_section : null,
        attendance: {
          present: Number(attendance?.present_count ?? 0),
          absent: Number(attendance?.absent_count ?? 0),
          late: Number(attendance?.late_count ?? 0),
          excused: Number(attendance?.excused_count ?? 0),
        },
      },
      coverage: {
        totalSectionSubjects,
        approvedGradebooks,
        isComplete:
          totalSectionSubjects > 0 &&
          approvedGradebooks === totalSectionSubjects,
      },
      subjects: subjectsResult.rows,
    };
  }

  async generate(studentId: string, gradingPeriodId: string) {
    const preview = await this.preview(studentId, gradingPeriodId);

    if (preview.subjects.length === 0) {
      throw new BadRequestException(
        'Cannot generate report card draft because there are no approved subject lines yet.',
      );
    }

    return this.db
      .withTransaction(async (client) => {
        const reportCard = await this.upsertReportCard(client, preview);
        await this.refreshReportCardItems(
          client,
          reportCard.id,
          preview.subjects,
        );
        return reportCard.id;
      })
      .then(() => this.findOne(studentId, gradingPeriodId));
  }

  async publish(
    studentId: string,
    gradingPeriodId: string,
    publishedByUserId: string,
  ) {
    const preview = await this.preview(studentId, gradingPeriodId);

    if (!preview.coverage.isComplete) {
      throw new BadRequestException({
        message:
          'Cannot publish report card because not all section gradebooks are approved.',
        coverage: preview.coverage,
      });
    }

    if (preview.subjects.length === 0) {
      throw new BadRequestException(
        'Cannot publish report card because there are no approved subject lines.',
      );
    }

    const reportCardId = await this.db.withTransaction(async (client) => {
      const reportCard = await this.upsertReportCard(client, preview);
      await this.refreshReportCardItems(
        client,
        reportCard.id,
        preview.subjects,
      );

      const publishResult = await client.query<ReportCardRow>(
        `
          UPDATE report_cards
          SET
            status = 'PUBLISHED',
            published_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
            AND deleted_at IS NULL
          RETURNING id
          `,
        [reportCard.id],
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
          SELECT
            sch.id,
            $2,
            'report_cards',
            $1,
            'PUBLISH',
            jsonb_build_object(
              'student_id', $3,
              'grading_period_id', $4
            )
          FROM schools sch
          JOIN students s ON s.school_id = sch.id
          WHERE s.id = $3
            AND s.deleted_at IS NULL
          LIMIT 1
          `,
        [reportCard.id, publishedByUserId, studentId, gradingPeriodId],
      );

      return publishResult.rows[0].id;
    });

    const saved = await this.findOne(studentId, gradingPeriodId);

    if (!saved || saved.reportCard.id !== reportCardId) {
      throw new NotFoundException(
        'Published report card could not be reloaded.',
      );
    }

    return saved;
  }

  async findPublishedForGuardian(
    guardianId: string,
    studentId: string,
    gradingPeriodId: string,
  ) {
    const accessResult = await this.db.query(
      `
        SELECT sg.id
        FROM student_guardians sg
        JOIN guardians g ON g.id = sg.guardian_id
        WHERE sg.guardian_id = $1
          AND sg.student_id = $2
          AND sg.can_view_academics = TRUE
          AND sg.deleted_at IS NULL
          AND g.deleted_at IS NULL
        LIMIT 1
        `,
      [guardianId, studentId],
    );

    if (accessResult.rows.length === 0) {
      throw new ForbiddenException(
        'Guardian does not have academic access to this student.',
      );
    }

    const saved = await this.findOne(studentId, gradingPeriodId);

    if (!saved || saved.reportCard.status !== 'PUBLISHED') {
      throw new NotFoundException('Published report card not found.');
    }

    return saved;
  }

  async assertUserCanGenerateReportCards(
    actorUserId: string,
    schoolId: string,
    platformRole: 'SUPER_ADMIN' | null,
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

    if (!roles.includes('SCHOOL_ADMIN')) {
      throw new ForbiddenException(
        'Only School Admin can generate report cards.',
      );
    }
  }

  async getAcademicOptions(schoolId: string) {
    const gradingPeriodsResult = await this.db.query<{
      id: string;
      name_i18n: Record<string, string>;
      start_date: string | null;
      end_date: string | null;
    }>(
      `
        SELECT
          gp.id,
          gp.name_i18n,
          gp.start_date::text AS start_date,
          gp.end_date::text AS end_date
        FROM grading_periods gp
        JOIN academic_years ay ON ay.id = gp.academic_year_id
        WHERE ay.school_id = $1
          AND gp.deleted_at IS NULL
          AND ay.deleted_at IS NULL
        ORDER BY
          gp.start_date DESC NULLS LAST,
          gp.end_date DESC NULLS LAST,
          gp.created_at DESC
        `,
      [schoolId],
    );

    const sectionsResult = await this.db.query<{
      id: string;
      code: string;
      name_i18n: Record<string, string> | null;
      grade_level_code: string | null;
      grade_level_name_i18n: Record<string, string> | null;
      academic_division: string | null;
      grade_level_display_order: string | null;
      section_display_order: string | null;
    }>(
      `
        SELECT
          se.id,
          se.code,
          se.name_i18n,
          gl.code AS grade_level_code,
          gl.name_i18n AS grade_level_name_i18n,
          gl.academic_division,
          gl.display_order::text AS grade_level_display_order,
          se.display_order::text AS section_display_order
        FROM sections se
        JOIN grade_levels gl
          ON gl.id = se.grade_level_id
         AND gl.deleted_at IS NULL
        WHERE se.school_id = $1
          AND se.deleted_at IS NULL
        ORDER BY
          COALESCE(gl.display_order, 9999),
          COALESCE(se.display_order, 9999),
          se.code ASC
        `,
      [schoolId],
    );

    return {
      schoolId,
      gradingPeriods: gradingPeriodsResult.rows.map((row) => ({
        id: row.id,
        nameI18n: row.name_i18n,
        startDate: row.start_date,
        endDate: row.end_date,
      })),
      sections: sectionsResult.rows.map((row) => ({
        id: row.id,
        code: row.code,
        nameI18n: row.name_i18n,
        gradeLevelCode: row.grade_level_code,
        gradeLevelNameI18n: row.grade_level_name_i18n,
        academicDivision: row.academic_division,
        gradeLevelDisplayOrder: Number(row.grade_level_display_order ?? 9999),
        sectionDisplayOrder: Number(row.section_display_order ?? 9999),
      })),
    };
  }

  async getGenerationReadiness(
    schoolId: string,
    gradingPeriodId: string,
    sectionId: string,
  ) {
    const sectionResult = await this.db.query<{
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
        WHERE se.id = $1
          AND se.school_id = $2
          AND se.deleted_at IS NULL
          AND gl.deleted_at IS NULL
        LIMIT 1
        `,
      [sectionId, schoolId],
    );

    const section = sectionResult.rows[0];

    if (!section) {
      throw new NotFoundException('Section not found for this school.');
    }

    const gradebooksResult = await this.db.query<{
      section_subject_id: string;
      subject_code: string;
      subject_name_i18n: Record<string, string>;
      gradebook_id: string | null;
      workflow_status: string | null;
    }>(
      `
        SELECT
          ss.id AS section_subject_id,
          sub.code AS subject_code,
          sub.name_i18n AS subject_name_i18n,
          gb.id AS gradebook_id,
          gb.workflow_status::text AS workflow_status
        FROM section_subjects ss
        JOIN subjects sub ON sub.id = ss.subject_id
        LEFT JOIN gradebooks gb
          ON gb.section_subject_id = ss.id
         AND gb.grading_period_id = $3
         AND gb.deleted_at IS NULL
        WHERE ss.section_id = $1
          AND ss.school_id = $2
          AND ss.deleted_at IS NULL
          AND ss.is_active = TRUE
          AND sub.deleted_at IS NULL
        ORDER BY sub.code ASC
        `,
      [sectionId, schoolId, gradingPeriodId],
    );

    const blockers = gradebooksResult.rows
      .filter((row) => row.workflow_status !== 'PUBLISHED')
      .map((row) => ({
        subjectCode: row.subject_code,
        subjectNameI18n: row.subject_name_i18n,
        status: row.workflow_status ?? 'MISSING',
      }));

    return {
      schoolId,
      gradingPeriodId,
      section,
      totalSubjects: gradebooksResult.rows.length,
      publishedSubjects: gradebooksResult.rows.filter(
        (row) => row.workflow_status === 'PUBLISHED',
      ).length,
      isReady: blockers.length === 0 && gradebooksResult.rows.length > 0,
      blockers,
    };
  }

  async generateForSection(
    dto: GenerateReportCardsDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanGenerateReportCards(
      actorUserId,
      dto.schoolId,
      platformRole,
    );

    const readiness = await this.getGenerationReadiness(
      dto.schoolId,
      dto.gradingPeriodId,
      dto.sectionId,
    );

    if (!readiness.isReady) {
      throw new ConflictException({
        message:
          'Report cards cannot be generated until all gradebooks are published.',
        blockers: readiness.blockers,
      });
    }

    return this.db.withTransaction(async (client) => {
      const batchResult = await client.query<{
        id: string;
      }>(
        `
          INSERT INTO report_card_batches (
            school_id,
            grading_period_id,
            section_id,
            batch_status,
            generated_by_user_id,
            notes
          )
          VALUES ($1, $2, $3, 'GENERATED', $4, $5)
          RETURNING id
          `,
        [
          dto.schoolId,
          dto.gradingPeriodId,
          dto.sectionId,
          actorUserId,
          dto.notes?.trim() ? dto.notes.trim() : null,
        ],
      );

      const batchId = batchResult.rows[0].id;

      const studentsResult = await client.query<{
        student_id: string;
        first_name: string | null;
        last_name: string | null;
        student_number: string | null;
      }>(
        `
          SELECT
            st.id AS student_id,
            st.first_name,
            st.last_name,
            st.student_number
          FROM enrollments en
          JOIN students st ON st.id = en.student_id
          WHERE en.section_id = $1
            AND en.deleted_at IS NULL
            AND st.deleted_at IS NULL
            AND en.enrollment_status = 'ACTIVE'
          ORDER BY st.last_name ASC NULLS LAST, st.first_name ASC NULLS LAST
          `,
        [dto.sectionId],
      );

      const resultsResult = await client.query<{
        student_id: string;
        subject_id: string;
        subject_code: string;
        subject_name_i18n: Record<string, string>;
        coefficient: string;
        subject_average: string;
      }>(
        `
          WITH assessment_scores_normalized AS (
            SELECT
              sc.student_id,
              sub.id AS subject_id,
              sub.code AS subject_code,
              sub.name_i18n AS subject_name_i18n,
              ss.coefficient,
              (
                (sc.raw_score / NULLIF(a.max_points_possible, 0)) * 20
              ) * (a.weight_within_term / 100.0) AS weighted_score
            FROM gradebooks gb
            JOIN section_subjects ss ON ss.id = gb.section_subject_id
            JOIN subjects sub ON sub.id = ss.subject_id
            JOIN assessments a ON a.gradebook_id = gb.id
            JOIN assessment_scores sc ON sc.assessment_id = a.id
            WHERE ss.section_id = $1
              AND ss.school_id = $3
              AND gb.grading_period_id = $2
              AND gb.workflow_status = 'PUBLISHED'
              AND gb.deleted_at IS NULL
              AND ss.deleted_at IS NULL
              AND sub.deleted_at IS NULL
              AND a.deleted_at IS NULL
              AND sc.deleted_at IS NULL
          )
          SELECT
            student_id,
            subject_id,
            subject_code,
            subject_name_i18n,
            coefficient::text,
            SUM(weighted_score)::text AS subject_average
          FROM assessment_scores_normalized
          GROUP BY
            student_id,
            subject_id,
            subject_code,
            subject_name_i18n,
            coefficient
          ORDER BY subject_code ASC
          `,
        [dto.sectionId, dto.gradingPeriodId, dto.schoolId],
      );

      const subjectResultsByStudent = new Map<
        string,
        Array<{
          subjectId: string;
          subjectCode: string;
          subjectNameI18n: Record<string, string>;
          coefficient: number;
          average: number;
        }>
      >();

      for (const row of resultsResult.rows) {
        const existing = subjectResultsByStudent.get(row.student_id) ?? [];

        existing.push({
          subjectId: row.subject_id,
          subjectCode: row.subject_code,
          subjectNameI18n: row.subject_name_i18n,
          coefficient: Number(row.coefficient),
          average: Number(Number(row.subject_average).toFixed(3)),
        });

        subjectResultsByStudent.set(row.student_id, existing);
      }

      const generatedCards: Array<{
        reportCardId: string;
        studentId: string;
        averageScore: number | null;
      }> = [];

      for (const student of studentsResult.rows) {
        const subjectResults =
          subjectResultsByStudent.get(student.student_id) ?? [];

        const coefficientTotal = subjectResults.reduce(
          (sum, item) => sum + Number(item.coefficient),
          0,
        );

        const weightedTotal = subjectResults.reduce(
          (sum, item) => sum + Number(item.average) * Number(item.coefficient),
          0,
        );

        const averageScore =
          coefficientTotal > 0
            ? Number((weightedTotal / coefficientTotal).toFixed(3))
            : null;

        const reportCardResult = await client.query<{
          id: string;
        }>(
          `
            INSERT INTO report_cards (
              batch_id,
              school_id,
              grading_period_id,
              section_id,
              student_id,
              status,
              overall_average,
              average_score,
              attendance_summary,
              subject_results,
              snapshot
            )
            VALUES ($1, $2, $3, $4, $5, 'APPROVED', $6, $6, '{}'::jsonb, $7::jsonb, $8::jsonb)
            ON CONFLICT (student_id, grading_period_id)
            DO UPDATE SET
              batch_id = EXCLUDED.batch_id,
              school_id = EXCLUDED.school_id,
              section_id = EXCLUDED.section_id,
              status = 'APPROVED',
              overall_average = EXCLUDED.overall_average,
              average_score = EXCLUDED.average_score,
              attendance_summary = EXCLUDED.attendance_summary,
              subject_results = EXCLUDED.subject_results,
              snapshot = EXCLUDED.snapshot,
              deleted_at = NULL,
              updated_at = NOW()
            RETURNING id
            `,
          [
            batchId,
            dto.schoolId,
            dto.gradingPeriodId,
            dto.sectionId,
            student.student_id,
            averageScore,
            JSON.stringify(subjectResults),
            JSON.stringify({
              student,
              generatedAt: new Date().toISOString(),
              scale: 20,
              note: 'V1 report card snapshot generated from published gradebooks.',
            }),
          ],
        );

        generatedCards.push({
          reportCardId: reportCardResult.rows[0].id,
          studentId: student.student_id,
          averageScore,
        });
      }

      const ranked = [...generatedCards]
        .filter((card) => card.averageScore !== null)
        .sort((a, b) => Number(b.averageScore) - Number(a.averageScore));

      for (let index = 0; index < ranked.length; index += 1) {
        await client.query(
          `
            UPDATE report_cards
            SET rank_in_section = $2,
                updated_at = NOW()
            WHERE id = $1
            `,
          [ranked[index].reportCardId, index + 1],
        );
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'REPORT_CARDS_GENERATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Report cards generated for section ${readiness.section.section_code}.`,
        payload: {
          batchId,
          gradingPeriodId: dto.gradingPeriodId,
          sectionId: dto.sectionId,
          generatedCount: generatedCards.length,
        },
      });

      return {
        batchId,
        schoolId: dto.schoolId,
        gradingPeriodId: dto.gradingPeriodId,
        sectionId: dto.sectionId,
        generatedCount: generatedCards.length,
      };
    });
  }
  async getReportCardDetails(reportCardId: string) {
    const result = await this.db.query<{
      report_card_id: string;
      batch_id: string;
      school_id: string;
      school_name: string;
      school_code: string;
      logo_url: string | null;
      address_line1: string | null;
      address_line2: string | null;
      city: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      director_name: string | null;
      report_card_title_i18n: Record<string, string>;
      report_card_footer_i18n: Record<string, string>;
      grading_period_id: string;
      grading_period_name_i18n: Record<string, string>;
      section_id: string;
      section_code: string;
      section_name_i18n: Record<string, string>;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string>;
      student_id: string;
      student_number: string | null;
      first_name: string | null;
      last_name: string | null;
      average_score: string | null;
      rank_in_section: string | null;
      conduct_note: string | null;
      teacher_comment: string | null;
      director_comment: string | null;
      final_decision_override: string | null;
      final_remarks: string | null;
      comments_updated_at: string | null;
      attendance_summary: unknown;
      subject_results: unknown;
      snapshot: unknown;
      batch_status: string;
      generated_at: string;
      published_at: string | null;
    }>(
      `
        SELECT
          rc.id AS report_card_id,
          rc.batch_id,
          rc.school_id,
          s.name AS school_name,
          s.code AS school_code,
          s.logo_url,
          s.address_line1,
          s.address_line2,
          s.city,
          s.phone,
          s.email,
          s.website,
          s.director_name,
          s.report_card_title_i18n,
          s.report_card_footer_i18n,
          rc.grading_period_id,
          gp.name_i18n AS grading_period_name_i18n,
          rc.section_id,
          se.code AS section_code,
          se.name_i18n AS section_name_i18n,
          gl.code AS grade_level_code,
          gl.name_i18n AS grade_level_name_i18n,
          rc.student_id,
          st.student_number,
          st.first_name,
          st.last_name,
          rc.average_score::text AS average_score,
          rc.rank_in_section::text AS rank_in_section,
          rc.conduct_note,
          rc.teacher_comment,
          rc.director_comment,
          rc.final_decision_override,
          rc.final_remarks,
          rc.comments_updated_at::text AS comments_updated_at,
          rc.attendance_summary,
          rc.subject_results,
          rc.snapshot,
          rcb.batch_status::text AS batch_status,
          rcb.generated_at::text AS generated_at,
          rcb.published_at::text AS published_at
        FROM report_cards rc
        JOIN report_card_batches rcb ON rcb.id = rc.batch_id
        JOIN schools s ON s.id = rc.school_id
        JOIN grading_periods gp ON gp.id = rc.grading_period_id
        JOIN sections se ON se.id = rc.section_id
        JOIN grade_levels gl ON gl.id = se.grade_level_id
        JOIN students st ON st.id = rc.student_id
        WHERE rc.id = $1
          AND rc.deleted_at IS NULL
          AND rcb.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND st.deleted_at IS NULL
        LIMIT 1
        `,
      [reportCardId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException(`Report card ${reportCardId} not found.`);
    }

    return {
      id: row.report_card_id,
      batchId: row.batch_id,
      school: {
        id: row.school_id,
        name: row.school_name,
        code: row.school_code,
        branding: {
          logoUrl: row.logo_url,
          addressLine1: row.address_line1,
          addressLine2: row.address_line2,
          city: row.city,
          phone: row.phone,
          email: row.email,
          website: row.website,
          directorName: row.director_name,
          reportCardTitleI18n: row.report_card_title_i18n,
          reportCardFooterI18n: row.report_card_footer_i18n,
        },
      },
      gradingPeriod: {
        id: row.grading_period_id,
        nameI18n: row.grading_period_name_i18n,
      },
      section: {
        id: row.section_id,
        code: row.section_code,
        nameI18n: row.section_name_i18n,
        gradeLevelCode: row.grade_level_code,
        gradeLevelNameI18n: row.grade_level_name_i18n,
      },
      student: {
        id: row.student_id,
        code: row.student_number,
        firstName: row.first_name,
        lastName: row.last_name,
      },
      averageScore:
        row.average_score === null
          ? null
          : Number(Number(row.average_score).toFixed(3)),
      rankInSection:
        row.rank_in_section === null ? null : Number(row.rank_in_section),
      conductNote: row.conduct_note,
      teacherComment: row.teacher_comment,
      directorComment: row.director_comment,
      finalDecisionOverride: row.final_decision_override,
      finalRemarks: row.final_remarks,
      commentsUpdatedAt: row.comments_updated_at,
      attendanceSummary: row.attendance_summary,
      subjectResults: row.subject_results,
      snapshot: row.snapshot,
      batchStatus: row.batch_status,
      generatedAt: row.generated_at,
      publishedAt: row.published_at,
    };
  }
  private async getBatchContext(batchId: string) {
    const result = await this.db.query<{
      id: string;
      school_id: string;
      grading_period_id: string;
      section_id: string | null;
      batch_status: string;
      section_code: string | null;
    }>(
      `
        SELECT
          rcb.id,
          rcb.school_id,
          rcb.grading_period_id,
          rcb.section_id,
          rcb.batch_status::text AS batch_status,
          se.code AS section_code
        FROM report_card_batches rcb
        LEFT JOIN sections se ON se.id = rcb.section_id
        WHERE rcb.id = $1
          AND rcb.deleted_at IS NULL
        LIMIT 1
        `,
      [batchId],
    );

    const batch = result.rows[0];

    if (!batch) {
      throw new NotFoundException(`Report card batch ${batchId} not found.`);
    }

    return batch;
  }

  async listBatches(query: {
    schoolId: string;
    gradingPeriodId?: string;
    sectionId?: string;
  }) {
    const values: unknown[] = [query.schoolId];
    const where: string[] = ['rcb.school_id = $1', 'rcb.deleted_at IS NULL'];

    if (query.gradingPeriodId) {
      values.push(query.gradingPeriodId);
      where.push(`rcb.grading_period_id = $${values.length}`);
    }

    if (query.sectionId) {
      values.push(query.sectionId);
      where.push(`rcb.section_id = $${values.length}`);
    }

    const result = await this.db.query<{
      id: string;
      school_id: string;
      grading_period_id: string;
      grading_period_name_i18n: Record<string, string>;
      section_id: string | null;
      section_code: string | null;
      section_name_i18n: Record<string, string> | null;
      grade_level_code: string | null;
      grade_level_name_i18n: Record<string, string> | null;
      batch_status: string;
      generated_at: string;
      published_at: string | null;
      generated_count: string;
      average_score: string | null;
    }>(
      `
        SELECT
          rcb.id,
          rcb.school_id,
          rcb.grading_period_id,
          gp.name_i18n AS grading_period_name_i18n,
          rcb.section_id,
          se.code AS section_code,
          se.name_i18n AS section_name_i18n,
          gl.code AS grade_level_code,
          gl.name_i18n AS grade_level_name_i18n,
          rcb.batch_status::text AS batch_status,
          rcb.generated_at::text AS generated_at,
          rcb.published_at::text AS published_at,
          COUNT(rc.id)::text AS generated_count,
          AVG(rc.average_score)::text AS average_score
        FROM report_card_batches rcb
        JOIN grading_periods gp ON gp.id = rcb.grading_period_id
        LEFT JOIN sections se ON se.id = rcb.section_id
        LEFT JOIN grade_levels gl ON gl.id = se.grade_level_id
        LEFT JOIN report_cards rc
          ON rc.batch_id = rcb.id
         AND rc.deleted_at IS NULL
        WHERE ${where.join(' AND ')}
        GROUP BY
          rcb.id,
          rcb.school_id,
          rcb.grading_period_id,
          gp.name_i18n,
          rcb.section_id,
          se.code,
          se.name_i18n,
          gl.code,
          gl.name_i18n,
          rcb.batch_status,
          rcb.generated_at,
          rcb.published_at
        ORDER BY rcb.generated_at DESC
        `,
      values,
    );

    return result.rows.map((row) => ({
      id: row.id,
      schoolId: row.school_id,
      gradingPeriodId: row.grading_period_id,
      gradingPeriodNameI18n: row.grading_period_name_i18n,
      sectionId: row.section_id,
      sectionCode: row.section_code,
      sectionNameI18n: row.section_name_i18n,
      gradeLevelCode: row.grade_level_code,
      gradeLevelNameI18n: row.grade_level_name_i18n,
      batchStatus: row.batch_status,
      generatedAt: row.generated_at,
      publishedAt: row.published_at,
      generatedCount: Number(row.generated_count),
      averageScore:
        row.average_score === null
          ? null
          : Number(Number(row.average_score).toFixed(3)),
    }));
  }

  async getBatchDetails(batchId: string) {
    await this.getBatchContext(batchId);

    const batchResult = await this.db.query<{
      id: string;
      school_id: string;
      grading_period_id: string;
      grading_period_name_i18n: Record<string, string>;
      section_id: string | null;
      section_code: string | null;
      section_name_i18n: Record<string, string> | null;
      grade_level_code: string | null;
      grade_level_name_i18n: Record<string, string> | null;
      batch_status: string;
      generated_at: string;
      published_at: string | null;
      notes: string | null;
    }>(
      `
        SELECT
          rcb.id,
          rcb.school_id,
          rcb.grading_period_id,
          gp.name_i18n AS grading_period_name_i18n,
          rcb.section_id,
          se.code AS section_code,
          se.name_i18n AS section_name_i18n,
          gl.code AS grade_level_code,
          gl.name_i18n AS grade_level_name_i18n,
          rcb.batch_status::text AS batch_status,
          rcb.generated_at::text AS generated_at,
          rcb.published_at::text AS published_at,
          rcb.notes
        FROM report_card_batches rcb
        JOIN grading_periods gp ON gp.id = rcb.grading_period_id
        LEFT JOIN sections se ON se.id = rcb.section_id
        LEFT JOIN grade_levels gl ON gl.id = se.grade_level_id
        WHERE rcb.id = $1
          AND rcb.deleted_at IS NULL
        LIMIT 1
        `,
      [batchId],
    );

    const cardsResult = await this.db.query<{
      id: string;
      student_id: string;
      student_number: string | null;
      first_name: string | null;
      last_name: string | null;
      average_score: string | null;
      rank_in_section: string | null;
      subject_results: unknown;
      attendance_summary: unknown;
      created_at: string;
    }>(
      `
        SELECT
          rc.id,
          rc.student_id,
          st.student_number,
          st.first_name,
          st.last_name,
          rc.average_score::text AS average_score,
          rc.rank_in_section::text AS rank_in_section,
          rc.subject_results,
          rc.attendance_summary,
          rc.created_at::text AS created_at
        FROM report_cards rc
        JOIN students st ON st.id = rc.student_id
        WHERE rc.batch_id = $1
          AND rc.deleted_at IS NULL
          AND st.deleted_at IS NULL
        ORDER BY
          rc.rank_in_section ASC NULLS LAST,
          st.last_name ASC NULLS LAST,
          st.first_name ASC NULLS LAST
        `,
      [batchId],
    );

    const batchRow = batchResult.rows[0];

    return {
      batch: {
        id: batchRow.id,
        schoolId: batchRow.school_id,
        gradingPeriodId: batchRow.grading_period_id,
        gradingPeriodNameI18n: batchRow.grading_period_name_i18n,
        sectionId: batchRow.section_id,
        sectionCode: batchRow.section_code,
        sectionNameI18n: batchRow.section_name_i18n,
        gradeLevelCode: batchRow.grade_level_code,
        gradeLevelNameI18n: batchRow.grade_level_name_i18n,
        batchStatus: batchRow.batch_status,
        generatedAt: batchRow.generated_at,
        publishedAt: batchRow.published_at,
        notes: batchRow.notes,
      },
      cards: cardsResult.rows.map((row) => ({
        id: row.id,
        studentId: row.student_id,
        studentCode: row.student_number,
        firstName: row.first_name,
        lastName: row.last_name,
        averageScore:
          row.average_score === null
            ? null
            : Number(Number(row.average_score).toFixed(3)),
        rankInSection:
          row.rank_in_section === null ? null : Number(row.rank_in_section),
        subjectResults: row.subject_results,
        attendanceSummary: row.attendance_summary,
        createdAt: row.created_at,
      })),
    };
  }

  async getBatchPrintDetails(batchId: string) {
    const batch = await this.getBatchContext(batchId);

    const cardsResult = await this.db.query<{
      report_card_id: string;
    }>(
      `
        SELECT rc.id AS report_card_id
        FROM report_cards rc
        JOIN students st ON st.id = rc.student_id
        WHERE rc.batch_id = $1
          AND rc.deleted_at IS NULL
          AND st.deleted_at IS NULL
        ORDER BY
          rc.rank_in_section ASC NULLS LAST,
          st.last_name ASC NULLS LAST,
          st.first_name ASC NULLS LAST
        `,
      [batchId],
    );

    const cards: Array<
      Awaited<ReturnType<ReportCardsService['getReportCardDetails']>>
    > = [];

    for (const row of cardsResult.rows) {
      const details = await this.getReportCardDetails(row.report_card_id);
      cards.push(details);
    }

    return {
      batchId,
      schoolId: batch.school_id,
      batchStatus: batch.batch_status,
      cards,
    };
  }
  async publishBatch(
    batchId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const batch = await this.getBatchContext(batchId);

    await this.assertUserCanGenerateReportCards(
      actorUserId,
      batch.school_id,
      platformRole,
    );

    if (batch.batch_status !== 'GENERATED') {
      throw new ConflictException(
        `Only GENERATED report card batches can be published. Current status: ${batch.batch_status}.`,
      );
    }

    return this.db.withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        batch_status: string;
        published_at: string;
      }>(
        `
          UPDATE report_card_batches
          SET
            batch_status = 'PUBLISHED',
            published_by_user_id = $2,
            published_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
            AND deleted_at IS NULL
          RETURNING id, batch_status::text AS batch_status, published_at::text
          `,
        [batchId, actorUserId],
      );

      await client.query(
        `
          UPDATE report_cards
          SET status = 'PUBLISHED',
              published_at = NOW(),
              updated_at = NOW()
          WHERE batch_id = $1
            AND deleted_at IS NULL
          `,
        [batchId],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'REPORT_CARD_BATCH_PUBLISHED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: batch.school_id,
        summary: `Report card batch published for section ${batch.section_code ?? '-'}.`,
        payload: {
          batchId,
          gradingPeriodId: batch.grading_period_id,
          sectionId: batch.section_id,
        },
      });

      return result.rows[0];
    });
  }
  async updateReportCardComments(
    reportCardId: string,
    input: UpdateReportCardCommentsDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const details = await this.getReportCardDetails(reportCardId);

    await this.assertUserCanGenerateReportCards(
      actorUserId,
      details.school.id,
      platformRole,
    );

    const result = await this.db.query<{
      id: string;
      conduct_note: string | null;
      teacher_comment: string | null;
      director_comment: string | null;
      final_decision_override: string | null;
      final_remarks: string | null;
      comments_updated_at: string;
    }>(
      `
        UPDATE report_cards
        SET
          conduct_note = $2,
          teacher_comment = $3,
          director_comment = $4,
          final_decision_override = $5,
          final_remarks = $6,
          comments_updated_by_user_id = $7,
          comments_updated_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING
          id,
          conduct_note,
          teacher_comment,
          director_comment,
          final_decision_override,
          final_remarks,
          comments_updated_at::text AS comments_updated_at
        `,
      [
        reportCardId,
        input.conductNote?.trim() || null,
        input.teacherComment?.trim() || null,
        input.directorComment?.trim() || null,
        input.finalDecisionOverride?.trim() || null,
        input.finalRemarks?.trim() || null,
        actorUserId,
      ],
    );

    await this.platformActivityService.record({
      eventType: 'REPORT_CARD_COMMENTS_UPDATED',
      actorType: platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
      actorUserId,
      schoolId: details.school.id,
      summary: `Report card comments updated for ${details.student.firstName ?? ''} ${details.student.lastName ?? ''}.`,
      payload: {
        reportCardId,
        batchId: details.batchId,
        studentId: details.student.id,
      },
    });

    return result.rows[0];
  }
  private async getStudentAcademicContext(
    studentId: string,
    gradingPeriodId: string,
  ) {
    const result = await this.db.query<{
      student_id: string;
      student_number: string;
      student_first_name: string;
      student_last_name: string;
      grading_period_id: string;
      grading_period_name_i18n: Record<string, string>;
      academic_year_id: string;
      academic_year_name_i18n: Record<string, string>;
      section_id: string;
      section_code: string;
      section_name_i18n: Record<string, string>;
      grade_level_id: string;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string>;
    }>(
      `
        SELECT
          s.id AS student_id,
          s.student_number,
          s.first_name AS student_first_name,
          s.last_name AS student_last_name,
          gp.id AS grading_period_id,
          gp.name_i18n AS grading_period_name_i18n,
          ay.id AS academic_year_id,
          ay.name_i18n AS academic_year_name_i18n,
          sec.id AS section_id,
          sec.code AS section_code,
          sec.name_i18n AS section_name_i18n,
          gl.id AS grade_level_id,
          gl.code AS grade_level_code,
          gl.name_i18n AS grade_level_name_i18n
        FROM students s
        JOIN grading_periods gp ON gp.id = $2
        JOIN academic_years ay ON ay.id = gp.academic_year_id
        JOIN enrollments e
          ON e.student_id = s.id
         AND e.academic_year_id = ay.id
         AND e.enrollment_status = 'ACTIVE'
         AND e.deleted_at IS NULL
        JOIN sections sec ON sec.id = e.section_id
        JOIN grade_levels gl ON gl.id = e.grade_level_id
        WHERE s.id = $1
          AND s.deleted_at IS NULL
          AND gp.deleted_at IS NULL
          AND ay.deleted_at IS NULL
          AND sec.deleted_at IS NULL
          AND gl.deleted_at IS NULL
        LIMIT 1
        `,
      [studentId, gradingPeriodId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException(
        `Could not resolve academic context for student ${studentId} and grading period ${gradingPeriodId}.`,
      );
    }

    return row;
  }

  private async upsertReportCard(
    client: PoolClient,
    preview: ReportCardPreview,
  ): Promise<ReportCardRow> {
    const result = await client.query<ReportCardRow>(
      `
        INSERT INTO report_cards (
          student_id,
          section_id,
          grading_period_id,
          status,
          overall_average,
          rank_in_section,
          attendance_summary,
          conduct_label_i18n,
          published_at
        )
        VALUES (
          $1, $2, $3, 'DRAFT', $4, $5, $6::jsonb, NULL, NULL
        )
        ON CONFLICT (student_id, grading_period_id)
        DO UPDATE SET
          section_id = EXCLUDED.section_id,
          status = 'DRAFT',
          overall_average = EXCLUDED.overall_average,
          rank_in_section = EXCLUDED.rank_in_section,
          attendance_summary = EXCLUDED.attendance_summary,
          conduct_label_i18n = NULL,
          published_at = NULL,
          deleted_at = NULL,
          updated_at = NOW()
        RETURNING
          id,
          student_id,
          section_id,
          grading_period_id,
          status,
          overall_average,
          rank_in_section,
          attendance_summary,
          conduct_label_i18n,
          published_at,
          created_at,
          updated_at
        `,
      [
        preview.student.id,
        preview.academic.sectionId,
        preview.academic.gradingPeriodId,
        preview.summary.overallAverage,
        preview.summary.rankInSection,
        JSON.stringify(preview.summary.attendance),
      ],
    );

    return result.rows[0];
  }

  private async refreshReportCardItems(
    client: PoolClient,
    reportCardId: string,
    subjects: ReportCardSubjectLine[],
  ) {
    await client.query(
      `
        UPDATE report_card_items
        SET deleted_at = NOW(),
            updated_at = NOW()
        WHERE report_card_id = $1
          AND deleted_at IS NULL
        `,
      [reportCardId],
    );

    for (const subject of subjects) {
      await client.query(
        `
          INSERT INTO report_card_items (
            report_card_id,
            section_subject_id,
            subject_name_snapshot_i18n,
            coefficient,
            subject_average,
            passing_mark,
            teacher_comment_i18n
          )
          VALUES ($1, $2, $3::jsonb, $4, $5, $6, NULL)
          ON CONFLICT (report_card_id, section_subject_id)
          DO UPDATE SET
            subject_name_snapshot_i18n = EXCLUDED.subject_name_snapshot_i18n,
            coefficient = EXCLUDED.coefficient,
            subject_average = EXCLUDED.subject_average,
            passing_mark = EXCLUDED.passing_mark,
            teacher_comment_i18n = NULL,
            deleted_at = NULL,
            updated_at = NOW()
          `,
        [
          reportCardId,
          subject.section_subject_id,
          JSON.stringify(subject.subject_name_i18n),
          subject.coefficient,
          subject.subject_average,
          subject.passing_mark,
        ],
      );
    }
  }
}
