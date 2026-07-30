import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { SaveScoresDto } from './dto/save-scores.dto';

type GradebookRow = {
  id: string;
  section_subject_id: string;
  grading_period_id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
  submitted_by_user_id: string | null;
  submitted_at: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  published_by_user_id: string | null;
  published_at: string | null;
  rejection_reason_i18n: Record<string, string> | null;
  created_at: string;
  updated_at: string;
};

type GradebookReadiness = {
  gradebookId: string;
  status: string;
  assessmentCount: number;
  totalWeightPercent: number;
  expectedStudentCount: number;
  scoredEntriesCount: number;
  requiredScoreEntriesCount: number;
  missingScoreEntriesCount: number;
  isWeightValid: boolean;
  isComplete: boolean;
  canSubmit: boolean;
};

@Injectable()
export class GradebooksService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  async assertUserCanAccessGradebooks(
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

    const userRoles = membershipResult.rows.map((row) => row.role);
    const hasAllowedRole = allowedRoles.some((role) =>
      userRoles.includes(role),
    );

    if (!hasAllowedRole) {
      throw new ForbiddenException(
        'You do not have permission to perform this gradebook action.',
      );
    }
  }

  async getGradebookContext(
    input: {
      schoolId: string;
      sectionId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessGradebooks(
      actorUserId,
      input.schoolId,
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
      [input.sectionId, input.schoolId],
    );

    const section = sectionResult.rows[0];

    if (!section) {
      throw new NotFoundException('Section not found for this school.');
    }

    const studentsResult = await this.db.query<{
      id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
    }>(
      `
      SELECT
        st.id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.first_name,
        st.last_name
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
      [input.sectionId, input.schoolId],
    );

    return {
      section: {
        id: section.id,
        code: section.code,
        nameI18n: section.name_i18n,
        gradeLevelCode: section.grade_level_code,
        gradeLevelNameI18n: section.grade_level_name_i18n,
      },
      students: studentsResult.rows.map((row) => ({
        id: row.id,
        studentCode: row.student_code,
        firstName: row.first_name,
        lastName: row.last_name,
      })),
    };
  }

  async createAssessment(
    dto: CreateAssessmentDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessGradebooks(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const title = dto.title.trim();

    if (!title) {
      throw new BadRequestException('Assessment title is required.');
    }

    if (!Number.isFinite(dto.maxPoints) || dto.maxPoints <= 0) {
      throw new BadRequestException('Max points must be greater than zero.');
    }

    const sectionResult = await this.db.query(
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

    const subjectResult = await this.db.query<{
      id: string;
      code: string;
      name_i18n: Record<string, string>;
    }>(
      `
      SELECT
        subj.id,
        subj.code,
        subj.name_i18n
      FROM school_subjects subj
      JOIN grade_level_subjects gls
        ON gls.subject_id = subj.id
       AND gls.deleted_at IS NULL
      JOIN sections se
        ON se.grade_level_id = gls.grade_level_id
       AND se.deleted_at IS NULL
      WHERE subj.id = $1
        AND subj.school_id = $2
        AND se.id = $3
        AND subj.deleted_at IS NULL
        AND subj.subject_active = TRUE
      LIMIT 1
      `,
      [dto.subjectId, dto.schoolId, dto.sectionId],
    );

    const subject = subjectResult.rows[0];

    if (!subject) {
      throw new BadRequestException(
        'This subject is not assigned to the selected class/grade level.',
      );
    }

    const subjectName =
      subject.name_i18n?.fr ?? subject.name_i18n?.en ?? subject.code;

    const result = await this.db.query<{
      id: string;
      subject_name: string;
      title: string;
      assessment_type: string;
      assessment_date: string | null;
      max_points: string;
      weight_percent: string;
      created_at: string;
    }>(
      `
      INSERT INTO gradebook_assessments (
        school_id,
        section_id,
        subject_id,
        subject_name,
        title,
        assessment_type,
        assessment_date,
        max_points,
        weight_percent,
        notes,
        created_by_user_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::date,
        $8,
        $9,
        $10,
        $11
      )
      RETURNING
        id,
        subject_name,
        title,
        assessment_type,
        assessment_date::text AS assessment_date,
        max_points::text AS max_points,
        weight_percent::text AS weight_percent,
        created_at::text AS created_at
      `,
      [
        dto.schoolId,
        dto.sectionId,
        dto.subjectId,
        subjectName,
        title,
        dto.assessmentType ?? 'QUIZ',
        dto.assessmentDate || null,
        dto.maxPoints,
        dto.weightPercent ?? 100,
        dto.notes?.trim() || null,
        actorUserId,
      ],
    );

    return {
      id: result.rows[0].id,
      subjectName: result.rows[0].subject_name,
      title: result.rows[0].title,
      assessmentType: result.rows[0].assessment_type,
      assessmentDate: result.rows[0].assessment_date,
      maxPoints: Number(result.rows[0].max_points),
      weightPercent: Number(result.rows[0].weight_percent),
      createdAt: result.rows[0].created_at,
    };
  }
  async listAssessments(
    input: {
      schoolId: string;
      sectionId: string;
      subjectId?: string;
      subjectName?: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessGradebooks(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const result = await this.db.query<{
      id: string;
      subject_name: string;
      title: string;
      assessment_type: string;
      assessment_date: string | null;
      max_points: string;
      weight_percent: string;
      score_count: string;
      average_score: string | null;
      created_at: string;
    }>(
      `
      SELECT
        ass.id,
        ass.subject_name,
        ass.title,
        ass.assessment_type,
        ass.assessment_date::text AS assessment_date,
        ass.max_points::text AS max_points,
        ass.weight_percent::text AS weight_percent,
        COUNT(score.id)::text AS score_count,
        AVG(score.score)::text AS average_score,
        ass.created_at::text AS created_at
      FROM gradebook_assessments ass
      LEFT JOIN gradebook_scores score
        ON score.assessment_id = ass.id
       AND score.deleted_at IS NULL
       AND score.score IS NOT NULL
      WHERE ass.school_id = $1
        AND ass.section_id = $2
        AND ass.deleted_at IS NULL
        AND ($3::uuid IS NULL OR ass.subject_id = $3)
      GROUP BY ass.id
      ORDER BY COALESCE(ass.assessment_date, ass.created_at::date) DESC, ass.created_at DESC
      `,
      [input.schoolId, input.sectionId, input.subjectId ?? null],
    );

    return result.rows.map((row) => ({
      id: row.id,
      subjectName: row.subject_name,
      title: row.title,
      assessmentType: row.assessment_type,
      assessmentDate: row.assessment_date,
      maxPoints: Number(row.max_points),
      weightPercent: Number(row.weight_percent),
      scoreCount: Number(row.score_count),
      averageScore:
        row.average_score === null ? null : Number(row.average_score),
      createdAt: row.created_at,
    }));
  }

  async getAssessmentScores(
    input: {
      schoolId: string;
      assessmentId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessGradebooks(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const assessmentResult = await this.db.query<{
      id: string;
      section_id: string;
      subject_name: string;
      title: string;
      assessment_type: string;
      max_points: string;
    }>(
      `
      SELECT
        id,
        section_id,
        subject_name,
        title,
        assessment_type,
        max_points::text AS max_points
      FROM gradebook_assessments
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.assessmentId, input.schoolId],
    );

    const assessment = assessmentResult.rows[0];

    if (!assessment) {
      throw new NotFoundException('Assessment not found.');
    }

    const studentsResult = await this.db.query<{
      student_id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
      score_id: string | null;
      score: string | null;
      note: string | null;
    }>(
      `
      SELECT
        st.id AS student_id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.first_name,
        st.last_name,
        score.id AS score_id,
        score.score::text AS score,
        score.note
      FROM enrollments en
      JOIN students st
        ON st.id = en.student_id
       AND st.deleted_at IS NULL
      LEFT JOIN gradebook_scores score
        ON score.student_id = st.id
       AND score.assessment_id = $3
       AND score.deleted_at IS NULL
      WHERE en.section_id = $1
        AND en.deleted_at IS NULL
        AND en.enrollment_status = 'ACTIVE'
        AND st.school_id = $2
      ORDER BY st.last_name ASC, st.first_name ASC
      `,
      [assessment.section_id, input.schoolId, input.assessmentId],
    );

    return {
      assessment: {
        id: assessment.id,
        sectionId: assessment.section_id,
        subjectName: assessment.subject_name,
        title: assessment.title,
        assessmentType: assessment.assessment_type,
        maxPoints: Number(assessment.max_points),
      },
      students: studentsResult.rows.map((row) => ({
        id: row.student_id,
        studentCode: row.student_code,
        firstName: row.first_name,
        lastName: row.last_name,
        score: row.score === null ? null : Number(row.score),
        note: row.note,
      })),
    };
  }

  async saveScores(
    dto: SaveScoresDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessGradebooks(
      actorUserId,
      dto.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    return this.db.withTransaction(async (client) => {
      const assessmentResult = await client.query<{
        id: string;
        section_id: string;
        title: string;
        max_points: string;
      }>(
        `
        SELECT id, section_id, title, max_points::text AS max_points
        FROM gradebook_assessments
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.assessmentId, dto.schoolId],
      );

      const assessment = assessmentResult.rows[0];

      if (!assessment) {
        throw new NotFoundException('Assessment not found.');
      }

      const maxPoints = Number(assessment.max_points);
      const studentIds = dto.scores.map((record) => record.studentId);

      if (new Set(studentIds).size !== studentIds.length) {
        throw new BadRequestException(
          'Duplicate student scores are not allowed.',
        );
      }

      const enrolledResult = await client.query<{ student_id: string }>(
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
        [assessment.section_id, dto.schoolId, studentIds],
      );

      const enrolledStudentIds = new Set(
        enrolledResult.rows.map((row) => row.student_id),
      );

      for (const record of dto.scores) {
        if (!enrolledStudentIds.has(record.studentId)) {
          throw new BadRequestException(
            'One or more students are not assigned to this class/section.',
          );
        }

        if (
          record.score !== undefined &&
          record.score !== null &&
          record.score > maxPoints
        ) {
          throw new BadRequestException(
            `Score cannot exceed max points (${maxPoints}).`,
          );
        }

        await client.query(
          `
          INSERT INTO gradebook_scores (
            school_id,
            assessment_id,
            student_id,
            score,
            note
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (assessment_id, student_id)
          DO UPDATE SET
            score = EXCLUDED.score,
            note = EXCLUDED.note,
            deleted_at = NULL,
            updated_at = NOW()
          `,
          [
            dto.schoolId,
            dto.assessmentId,
            record.studentId,
            record.score ?? null,
            record.note?.trim() || null,
          ],
        );
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'GRADEBOOK_SCORES_SAVED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Scores saved for assessment ${assessment.title}.`,
        payload: {
          assessmentId: dto.assessmentId,
          scoreCount: dto.scores.length,
        },
      });

      return {
        assessmentId: dto.assessmentId,
        scoreCount: dto.scores.length,
        savedAt: new Date().toISOString(),
      };
    });
  }
  async getStudentReportCard(
    input: {
      schoolId: string;
      studentId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessGradebooks(
      actorUserId,
      input.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const studentResult = await this.db.query<{
      student_id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
      student_status: string;
      section_id: string | null;
      section_code: string | null;
      section_name_i18n: Record<string, string> | null;
      grade_level_code: string | null;
      grade_level_name_i18n: Record<string, string> | null;
      school_name: string;
      school_code: string | null;
    }>(
      `
      SELECT
        st.id AS student_id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.first_name,
        st.last_name,
        st.status::text AS student_status,
        se.id AS section_id,
        se.code AS section_code,
        se.name_i18n AS section_name_i18n,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n,
        sc.name AS school_name,
        sc.code AS school_code
      FROM students st
      JOIN schools sc
        ON sc.id = st.school_id
       AND sc.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT en.section_id
        FROM enrollments en
        WHERE en.student_id = st.id
          AND en.deleted_at IS NULL
          AND en.enrollment_status = 'ACTIVE'
        ORDER BY en.created_at DESC
        LIMIT 1
      ) current_enrollment ON TRUE
      LEFT JOIN sections se
        ON se.id = current_enrollment.section_id
       AND se.deleted_at IS NULL
      LEFT JOIN grade_levels gl
        ON gl.id = se.grade_level_id
       AND gl.deleted_at IS NULL
      WHERE st.id = $1
        AND st.school_id = $2
        AND st.deleted_at IS NULL
      LIMIT 1
      `,
      [input.studentId, input.schoolId],
    );

    const student = studentResult.rows[0];

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }

    const scoresResult = await this.db.query<{
      subject_id: string | null;
      subject_name: string;
      coefficient: string;
      assessment_id: string;
      assessment_title: string;
      assessment_type: string;
      assessment_date: string | null;
      max_points: string;
      weight_percent: string;
      score: string | null;
      note: string | null;
    }>(
      `
      SELECT
        ass.subject_id,
        ass.subject_name,
        COALESCE(gls.coefficient, 1)::text AS coefficient,
        ass.id AS assessment_id,
        ass.title AS assessment_title,
        ass.assessment_type,
        ass.assessment_date::text AS assessment_date,
        ass.max_points::text AS max_points,
        ass.weight_percent::text AS weight_percent,
        score.score::text AS score,
        score.note
      FROM gradebook_assessments ass
      LEFT JOIN gradebook_scores score
        ON score.assessment_id = ass.id
       AND score.student_id = $2
       AND score.deleted_at IS NULL
      LEFT JOIN grade_level_subjects gls
        ON gls.subject_id = ass.subject_id
       AND gls.school_id = ass.school_id
       AND gls.grade_level_id = (
          SELECT se.grade_level_id
          FROM sections se
          WHERE se.id = ass.section_id
          LIMIT 1
       )
       AND gls.deleted_at IS NULL
      WHERE ass.school_id = $1
        AND ass.deleted_at IS NULL
        AND (
          ass.section_id = $3
          OR $3::uuid IS NULL
        )
      ORDER BY
        COALESCE(gls.display_order, 9999),
        ass.subject_name ASC,
        COALESCE(ass.assessment_date, ass.created_at::date) ASC
      `,
      [input.schoolId, input.studentId, student.section_id],
    );

    const attendanceResult = await this.db.query<{
      attendance_status: string;
      count: string;
    }>(
      `
      SELECT
        rec.status::text AS attendance_status,
        COUNT(*)::text AS count
      FROM attendance_records rec
      JOIN attendance_sessions sess
        ON sess.id = rec.attendance_session_id
       AND sess.deleted_at IS NULL
      WHERE sess.school_id = $1
        AND rec.student_id = $2
        AND rec.deleted_at IS NULL
      GROUP BY rec.status
      `,
      [input.schoolId, input.studentId],
    );

    const attendanceTotals = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    for (const row of attendanceResult.rows) {
      if (row.attendance_status === 'PRESENT')
        attendanceTotals.present = Number(row.count);
      if (row.attendance_status === 'ABSENT')
        attendanceTotals.absent = Number(row.count);
      if (row.attendance_status === 'LATE')
        attendanceTotals.late = Number(row.count);
      if (row.attendance_status === 'EXCUSED')
        attendanceTotals.excused = Number(row.count);
    }

    const subjectMap = new Map<
      string,
      {
        subjectId: string | null;
        subjectName: string;
        coefficient: number;
        assessments: Array<{
          assessmentId: string;
          title: string;
          assessmentType: string;
          assessmentDate: string | null;
          maxPoints: number;
          weightPercent: number;
          score: number | null;
          note: string | null;
          percentage: number | null;
          scoreOn20: number | null;
        }>;
      }
    >();

    for (const row of scoresResult.rows) {
      const subjectKey = row.subject_id ?? row.subject_name;

      if (!subjectMap.has(subjectKey)) {
        subjectMap.set(subjectKey, {
          subjectId: row.subject_id,
          subjectName: row.subject_name,
          coefficient: Number(row.coefficient),
          assessments: [],
        });
      }

      const score = row.score === null ? null : Number(row.score);
      const maxPoints = Number(row.max_points);

      const percentage = score === null ? null : (score / maxPoints) * 100;
      const scoreOn20 = percentage === null ? null : (percentage / 100) * 20;

      subjectMap.get(subjectKey)!.assessments.push({
        assessmentId: row.assessment_id,
        title: row.assessment_title,
        assessmentType: row.assessment_type,
        assessmentDate: row.assessment_date,
        maxPoints,
        weightPercent: Number(row.weight_percent),
        score,
        note: row.note,
        percentage,
        scoreOn20,
      });
    }

    const subjects = Array.from(subjectMap.values()).map((subject) => {
      const scored = subject.assessments.filter(
        (item) => item.scoreOn20 !== null,
      );

      const averageOn20 =
        scored.length === 0
          ? null
          : scored.reduce((sum, item) => sum + (item.scoreOn20 ?? 0), 0) /
            scored.length;

      const averagePercent =
        averageOn20 === null ? null : (averageOn20 / 20) * 100;

      return {
        ...subject,
        averagePercent,
        averageOn20,
        weightedPoints:
          averageOn20 === null ? null : averageOn20 * subject.coefficient,
      };
    });

    const subjectsWithAverage = subjects.filter(
      (subject) => subject.averageOn20 !== null,
    );

    const totalCoefficient = subjectsWithAverage.reduce(
      (sum, subject) => sum + subject.coefficient,
      0,
    );

    const totalWeightedPoints = subjectsWithAverage.reduce(
      (sum, subject) => sum + (subject.weightedPoints ?? 0),
      0,
    );

    const generalAverageOn20 =
      totalCoefficient === 0 ? null : totalWeightedPoints / totalCoefficient;

    return {
      school: {
        name: student.school_name,
        code: student.school_code,
      },
      student: {
        id: student.student_id,
        studentCode: student.student_code,
        firstName: student.first_name,
        lastName: student.last_name,
        studentStatus: student.student_status,
      },
      currentClass: student.section_id
        ? {
            sectionId: student.section_id,
            sectionCode: student.section_code,
            sectionNameI18n: student.section_name_i18n,
            gradeLevelCode: student.grade_level_code,
            gradeLevelNameI18n: student.grade_level_name_i18n,
          }
        : null,
      subjects,
      attendanceTotals,
      summary: {
        generalAverageOn20,
        subjectCount: subjects.length,
        totalCoefficient,
        totalWeightedPoints,
      },
    };
  }
  private async getWorkflowGradebookContext(gradebookId: string) {
    const result = await this.db.query<{
      gradebook_id: string;
      workflow_status: string;
      school_id: string;
      section_id: string;
      section_code: string;
      subject_id: string;
      subject_code: string;
      grading_period_id: string;
    }>(
      `
      SELECT
        gb.id AS gradebook_id,
        gb.workflow_status::text AS workflow_status,
        se.school_id,
        se.id AS section_id,
        se.code AS section_code,
        sub.id AS subject_id,
        sub.code AS subject_code,
        gb.grading_period_id
      FROM gradebooks gb
      JOIN section_subjects ss ON ss.id = gb.section_subject_id
      JOIN sections se ON se.id = ss.section_id
      JOIN subjects sub ON sub.id = ss.subject_id
      WHERE gb.id = $1
        AND gb.deleted_at IS NULL
        AND ss.deleted_at IS NULL
        AND se.deleted_at IS NULL
        AND sub.deleted_at IS NULL
      LIMIT 1
      `,
      [gradebookId],
    );

    const context = result.rows[0];

    if (!context) {
      throw new NotFoundException(`Gradebook ${gradebookId} not found.`);
    }

    return context;
  }

  async checkReadiness(gradebookId: string) {
    const context = await this.getWorkflowGradebookContext(gradebookId);

    const assessmentsResult = await this.db.query<{
      assessment_id: string;
      title: string;
      max_points_possible: string;
      weight_within_term: string;
    }>(
      `
      SELECT
        a.id AS assessment_id,
        COALESCE(a.title_i18n->>'fr', a.title_i18n->>'en', a.id::text) AS title,
        a.max_points_possible::text,
        a.weight_percent::text AS weight_within_term
      FROM assessments a
      WHERE a.gradebook_id = $1
        AND a.deleted_at IS NULL
      ORDER BY a.created_at ASC
      `,
      [gradebookId],
    );

    const studentsResult = await this.db.query<{
      student_id: string;
    }>(
      `
      SELECT st.id AS student_id
      FROM enrollments en
      JOIN students st ON st.id = en.student_id
      JOIN section_subjects ss ON ss.section_id = en.section_id
      WHERE ss.id = (
        SELECT section_subject_id
        FROM gradebooks
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      )
        AND en.deleted_at IS NULL
        AND st.deleted_at IS NULL
        AND en.enrollment_status = 'ACTIVE'
      ORDER BY st.last_name ASC NULLS LAST, st.first_name ASC NULLS LAST
      `,
      [gradebookId],
    );

    const scoresResult = await this.db.query<{
      assessment_id: string;
      student_id: string;
      raw_score: string | null;
    }>(
      `
      SELECT
        sc.assessment_id,
        sc.student_id,
        sc.raw_score::text
      FROM assessment_scores sc
      JOIN assessments a ON a.id = sc.assessment_id
      WHERE a.gradebook_id = $1
        AND a.deleted_at IS NULL
        AND sc.deleted_at IS NULL
      `,
      [gradebookId],
    );

    const blockingIssues: string[] = [];
    const warnings: string[] = [];

    const assessments = assessmentsResult.rows.map((row) => ({
      assessmentId: row.assessment_id,
      title: row.title,
      maxPointsPossible: Number(row.max_points_possible),
      weightWithinTerm: Number(row.weight_within_term),
    }));

    const activeStudentIds = studentsResult.rows.map((row) => row.student_id);

    if (assessments.length === 0) {
      blockingIssues.push('Gradebook has no assessments.');
    }

    if (activeStudentIds.length === 0) {
      blockingIssues.push('Gradebook has no active enrolled students.');
    }

    const totalWeight = assessments.reduce(
      (sum, assessment) => sum + assessment.weightWithinTerm,
      0,
    );

    if (assessments.length > 0 && Math.round(totalWeight * 100) / 100 !== 100) {
      blockingIssues.push(
        `Assessment weights must total 100%. Current total is ${totalWeight}%.`,
      );
    }

    for (const assessment of assessments) {
      if (assessment.weightWithinTerm <= 0) {
        blockingIssues.push(
          `Assessment "${assessment.title}" has an invalid weight.`,
        );
      }

      if (assessment.maxPointsPossible <= 0) {
        blockingIssues.push(
          `Assessment "${assessment.title}" has invalid max points.`,
        );
      }
    }

    const scoreMap = new Map<string, number | null>();

    for (const score of scoresResult.rows) {
      scoreMap.set(
        `${score.assessment_id}:${score.student_id}`,
        score.raw_score === null ? null : Number(score.raw_score),
      );
    }

    let missingScores = 0;
    let invalidScores = 0;

    for (const assessment of assessments) {
      for (const studentId of activeStudentIds) {
        const key = `${assessment.assessmentId}:${studentId}`;

        if (!scoreMap.has(key) || scoreMap.get(key) === null) {
          missingScores += 1;
          continue;
        }

        const rawScore = scoreMap.get(key) ?? null;

        if (rawScore === null || Number.isNaN(rawScore)) {
          invalidScores += 1;
          continue;
        }

        if (rawScore < 0) {
          invalidScores += 1;
        }

        if (rawScore > assessment.maxPointsPossible) {
          invalidScores += 1;
        }
      }
    }

    if (missingScores > 0) {
      blockingIssues.push(`${missingScores} score(s) are missing.`);
    }

    if (invalidScores > 0) {
      blockingIssues.push(`${invalidScores} score(s) are invalid.`);
    }

    if (assessments.length > 0 && assessments.length < 2) {
      warnings.push(
        'Only one assessment exists. This is allowed but may be too limited for final reporting.',
      );
    }

    return {
      gradebookId,
      schoolId: context.school_id,
      workflowStatus: context.workflow_status,
      isReady: blockingIssues.length === 0,
      blockingIssues,
      warnings,
      summary: {
        assessments: assessments.length,
        activeStudents: activeStudentIds.length,
        totalWeight,
        expectedScoreEntries: assessments.length * activeStudentIds.length,
        existingScoreEntries: scoresResult.rows.length,
        missingScores,
        invalidScores,
      },
    };
  }

  async getOverview(
    schoolId: string,
    gradingPeriodId?: string,
    allowedSectionIds?: string[],
    allowedSubjectCodes?: string[],
  ) {
    const periodResult = gradingPeriodId
      ? await this.db.query<{
          id: string;
          name_i18n: Record<string, string>;
        }>(
          `
          SELECT gp.id, gp.name_i18n
          FROM grading_periods gp
          JOIN academic_years ay ON ay.id = gp.academic_year_id
          WHERE gp.id = $1
            AND ay.school_id = $2
            AND gp.deleted_at IS NULL
            AND ay.deleted_at IS NULL
          LIMIT 1
          `,
          [gradingPeriodId, schoolId],
        )
      : await this.db.query<{
          id: string;
          name_i18n: Record<string, string>;
        }>(
          `
          SELECT gp.id, gp.name_i18n
          FROM grading_periods gp
          JOIN academic_years ay ON ay.id = gp.academic_year_id
          WHERE ay.school_id = $1
            AND gp.deleted_at IS NULL
            AND ay.deleted_at IS NULL
            AND CURRENT_DATE BETWEEN gp.start_date AND gp.end_date
          ORDER BY gp.start_date ASC
          LIMIT 1
          `,
          [schoolId],
        );

    const period = periodResult.rows[0];

    if (!period) {
      return {
        schoolId,
        gradingPeriod: null,
        summary: {
          totalExpected: 0,
          missing: 0,
          draft: 0,
          submitted: 0,
          approved: 0,
          rejected: 0,
          published: 0,
          coveragePercent: 0,
          approvalQueue: 0,
        },
        rows: [],
      };
    }

    const rowsResult = await this.db.query<{
      section_subject_id: string;
      section_id: string;
      section_code: string;
      section_name_i18n: Record<string, string>;
      grade_level_code: string;
      grade_level_name_i18n: Record<string, string>;
      subject_id: string;
      subject_code: string;
      subject_name_i18n: Record<string, string>;
      coefficient: string;
      gradebook_id: string | null;
      workflow_status: string | null;
      submitted_at: string | null;
      approved_at: string | null;
      rejected_at: string | null;
      published_at: string | null;
    }>(
      `
      SELECT
        ss.id AS section_subject_id,
        se.id AS section_id,
        se.code AS section_code,
        se.name_i18n AS section_name_i18n,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n,
        sub.id AS subject_id,
        sub.code AS subject_code,
        sub.name_i18n AS subject_name_i18n,
        ss.coefficient::text AS coefficient,

        gb.id AS gradebook_id,
        gb.workflow_status::text AS workflow_status,
        gb.submitted_at::text AS submitted_at,
        gb.approved_at::text AS approved_at,
        gb.rejected_at::text AS rejected_at,
        gb.published_at::text AS published_at

      FROM section_subjects ss
      JOIN sections se ON se.id = ss.section_id
      JOIN grade_levels gl ON gl.id = se.grade_level_id
      JOIN subjects sub ON sub.id = ss.subject_id
      LEFT JOIN gradebooks gb
        ON gb.section_subject_id = ss.id
       AND gb.grading_period_id = $2
       AND gb.deleted_at IS NULL

      WHERE se.school_id = $1
        AND ss.deleted_at IS NULL
        AND ss.is_active = TRUE
        AND se.deleted_at IS NULL
        AND gl.deleted_at IS NULL
        AND sub.deleted_at IS NULL
        AND ($3::uuid[] IS NULL OR EXISTS (
          SELECT 1 FROM unnest($3::uuid[],$4::text[]) scope(section_id,subject_code)
          WHERE scope.section_id=se.id AND scope.subject_code=sub.code
        ))

      ORDER BY gl.display_order ASC, se.code ASC, sub.code ASC
      `,
      [
        schoolId,
        period.id,
        allowedSectionIds ?? null,
        allowedSubjectCodes ?? null,
      ],
    );

    const summary = {
      totalExpected: rowsResult.rows.length,
      missing: 0,
      draft: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      published: 0,
      coveragePercent: 0,
      approvalQueue: 0,
    };

    const rows = rowsResult.rows.map((row) => {
      const status = row.workflow_status ?? 'MISSING';

      if (status === 'MISSING') summary.missing += 1;
      if (status === 'DRAFT') summary.draft += 1;
      if (status === 'SUBMITTED') summary.submitted += 1;
      if (status === 'APPROVED') summary.approved += 1;
      if (status === 'REJECTED') summary.rejected += 1;
      if (status === 'PUBLISHED') summary.published += 1;

      if (status === 'SUBMITTED') {
        summary.approvalQueue += 1;
      }

      return {
        sectionSubjectId: row.section_subject_id,
        sectionId: row.section_id,
        sectionCode: row.section_code,
        sectionNameI18n: row.section_name_i18n,
        gradeLevelCode: row.grade_level_code,
        gradeLevelNameI18n: row.grade_level_name_i18n,
        subjectId: row.subject_id,
        subjectCode: row.subject_code,
        subjectNameI18n: row.subject_name_i18n,
        coefficient: Number(row.coefficient),
        gradebookId: row.gradebook_id,
        workflowStatus: status,
        submittedAt: row.submitted_at,
        approvedAt: row.approved_at,
        rejectedAt: row.rejected_at,
        publishedAt: row.published_at,
        needsAction:
          status === 'MISSING' ||
          status === 'DRAFT' ||
          status === 'SUBMITTED' ||
          status === 'REJECTED',
      };
    });

    const completed = summary.approved + summary.published;

    summary.coveragePercent =
      summary.totalExpected > 0
        ? Number(((completed / summary.totalExpected) * 100).toFixed(0))
        : 0;

    return {
      schoolId,
      gradingPeriod: {
        id: period.id,
        nameI18n: period.name_i18n,
      },
      summary,
      rows,
    };
  }
  async findOne(
    sectionSubjectId: string,
    gradingPeriodId: string,
  ): Promise<GradebookRow | null> {
    const result = await this.db.query<GradebookRow>(
      `
      SELECT
        id,
        section_subject_id,
        grading_period_id,
        status,
        submitted_by_user_id,
        submitted_at,
        approved_by_user_id,
        approved_at,
        published_by_user_id,
        published_at,
        rejection_reason_i18n,
        created_at,
        updated_at
      FROM gradebooks
      WHERE section_subject_id = $1
        AND grading_period_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [sectionSubjectId, gradingPeriodId],
    );

    return result.rows[0] ?? null;
  }

  async init(
    sectionSubjectId: string,
    gradingPeriodId: string,
  ): Promise<GradebookRow> {
    const sectionSubjectCheck = await this.db.query(
      `
      SELECT id
      FROM section_subjects
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [sectionSubjectId],
    );

    if (sectionSubjectCheck.rows.length === 0) {
      throw new NotFoundException(
        `Section subject ${sectionSubjectId} not found.`,
      );
    }

    const gradingPeriodCheck = await this.db.query(
      `
      SELECT id
      FROM grading_periods
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [gradingPeriodId],
    );

    if (gradingPeriodCheck.rows.length === 0) {
      throw new NotFoundException(
        `Grading period ${gradingPeriodId} not found.`,
      );
    }

    const existing = await this.findOne(sectionSubjectId, gradingPeriodId);

    if (existing) {
      return existing;
    }

    const result = await this.db.query<GradebookRow>(
      `
      INSERT INTO gradebooks (
        section_subject_id,
        grading_period_id,
        status
      )
      VALUES ($1, $2, 'DRAFT')
      RETURNING
        id,
        section_subject_id,
        grading_period_id,
        status,
        submitted_by_user_id,
        submitted_at,
        approved_by_user_id,
        approved_at,
        published_by_user_id,
        published_at,
        rejection_reason_i18n,
        created_at,
        updated_at
      `,
      [sectionSubjectId, gradingPeriodId],
    );

    return result.rows[0];
  }

  async getReadiness(gradebookId: string): Promise<GradebookReadiness> {
    const gradebookResult = await this.db.query<{
      id: string;
      status: GradebookRow['status'];
      section_id: string;
    }>(
      `
      SELECT
        gb.id,
        gb.status,
        ss.section_id
      FROM gradebooks gb
      JOIN section_subjects ss ON ss.id = gb.section_subject_id
      WHERE gb.id = $1
        AND gb.deleted_at IS NULL
        AND ss.deleted_at IS NULL
      LIMIT 1
      `,
      [gradebookId],
    );

    const gradebook = gradebookResult.rows[0];

    if (!gradebook) {
      throw new NotFoundException(`Gradebook ${gradebookId} not found.`);
    }

    const assessmentCountResult = await this.db.query<{
      count: string;
      total_weight: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS count,
        COALESCE(SUM(weight_percent), 0)::text AS total_weight
      FROM assessments
      WHERE gradebook_id = $1
        AND deleted_at IS NULL
      `,
      [gradebookId],
    );

    const expectedStudentsResult = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM enrollments
      WHERE section_id = $1
        AND enrollment_status = 'ACTIVE'
        AND deleted_at IS NULL
      `,
      [gradebook.section_id],
    );

    const scoredEntriesResult = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM assessment_scores sc
      JOIN assessments a ON a.id = sc.assessment_id
      WHERE a.gradebook_id = $1
        AND a.deleted_at IS NULL
        AND sc.deleted_at IS NULL
      `,
      [gradebookId],
    );

    const assessmentCount = Number(assessmentCountResult.rows[0]?.count ?? 0);
    const totalWeightPercent = Number(
      assessmentCountResult.rows[0]?.total_weight ?? 0,
    );
    const expectedStudentCount = Number(
      expectedStudentsResult.rows[0]?.count ?? 0,
    );
    const scoredEntriesCount = Number(scoredEntriesResult.rows[0]?.count ?? 0);
    const requiredScoreEntriesCount = assessmentCount * expectedStudentCount;
    const missingScoreEntriesCount =
      requiredScoreEntriesCount - scoredEntriesCount;
    const isWeightValid = totalWeightPercent === 100;
    const isComplete = missingScoreEntriesCount === 0 && assessmentCount > 0;
    const canSubmit =
      (gradebook.status === 'DRAFT' || gradebook.status === 'REJECTED') &&
      isWeightValid &&
      isComplete;

    return {
      gradebookId: gradebook.id,
      status: gradebook.status,
      assessmentCount,
      totalWeightPercent,
      expectedStudentCount,
      scoredEntriesCount,
      requiredScoreEntriesCount,
      missingScoreEntriesCount,
      isWeightValid,
      isComplete,
      canSubmit,
    };
  }

  async submit(
    gradebookId: string,
    submittedByUserId: string,
  ): Promise<GradebookRow> {
    const readiness = await this.getReadiness(gradebookId);

    if (!readiness.canSubmit) {
      throw new BadRequestException({
        message: 'Gradebook is not ready for submission.',
        readiness,
      });
    }

    const result = await this.db.query<GradebookRow>(
      `
      UPDATE gradebooks
      SET
        status = 'SUBMITTED',
        workflow_status = 'SUBMITTED',
        submitted_by_user_id = $2,
        submitted_at = NOW(),
        rejection_reason_i18n = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING
        id,
        section_subject_id,
        grading_period_id,
        status,
        submitted_by_user_id,
        submitted_at,
        approved_by_user_id,
        approved_at,
        published_by_user_id,
        published_at,
        rejection_reason_i18n,
        created_at,
        updated_at
      `,
      [gradebookId, submittedByUserId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException(`Gradebook ${gradebookId} not found.`);
    }

    return row;
  }

  async approve(
    gradebookId: string,
    approvedByUserId: string,
  ): Promise<GradebookRow> {
    const current = await this.db.query<GradebookRow>(
      `
      SELECT
        id,
        section_subject_id,
        grading_period_id,
        status,
        submitted_by_user_id,
        submitted_at,
        approved_by_user_id,
        approved_at,
        published_by_user_id,
        published_at,
        rejection_reason_i18n,
        created_at,
        updated_at
      FROM gradebooks
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [gradebookId],
    );

    const existing = current.rows[0];

    if (!existing) {
      throw new NotFoundException(`Gradebook ${gradebookId} not found.`);
    }

    if (existing.status !== 'SUBMITTED') {
      throw new BadRequestException(
        'Only SUBMITTED gradebooks can be approved.',
      );
    }

    const result = await this.db.query<GradebookRow>(
      `
      UPDATE gradebooks
      SET
        status = 'APPROVED',
        workflow_status = 'APPROVED',
        approved_by_user_id = $2,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING
        id,
        section_subject_id,
        grading_period_id,
        status,
        submitted_by_user_id,
        submitted_at,
        approved_by_user_id,
        approved_at,
        published_by_user_id,
        published_at,
        rejection_reason_i18n,
        created_at,
        updated_at
      `,
      [gradebookId, approvedByUserId],
    );

    return result.rows[0];
  }
  async submitGradebook(
    gradebookId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const context = await this.getWorkflowGradebookContext(gradebookId);

    await this.assertUserCanAccessGradebooks(
      actorUserId,
      context.school_id,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    if (!['DRAFT', 'REJECTED'].includes(context.workflow_status)) {
      throw new ConflictException(
        `Gradebook cannot be submitted from status ${context.workflow_status}.`,
      );
    }

    const readiness = await this.checkReadiness(gradebookId);

    if (!readiness.isReady) {
      throw new ConflictException({
        message: 'Gradebook is not ready for submission.',
        blockingIssues: readiness.blockingIssues,
        warnings: readiness.warnings,
        summary: readiness.summary,
      });
    }

    const result = await this.db.query<{
      id: string;
      workflow_status: string;
      submitted_at: Date;
    }>(
      `
      UPDATE gradebooks
      SET
        workflow_status = 'SUBMITTED',
        status = 'SUBMITTED',
        submitted_at = NOW(),
        submitted_by_user_id = $2,
        rejected_at = NULL,
        rejected_by_user_id = NULL,
        rejection_reason = NULL,
        rejection_reason_i18n = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, workflow_status, submitted_at
      `,
      [gradebookId, actorUserId],
    );

    await this.platformActivityService.record({
      eventType: 'GRADEBOOK_SUBMITTED',
      actorType: platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
      actorUserId,
      schoolId: context.school_id,
      summary: `Gradebook submitted for section ${context.section_code}, subject ${context.subject_code}.`,
      payload: {
        gradebookId,
        sectionId: context.section_id,
        subjectId: context.subject_id,
        gradingPeriodId: context.grading_period_id,
      },
    });

    return result.rows[0];
  }

  async approveGradebook(
    gradebookId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const context = await this.getWorkflowGradebookContext(gradebookId);

    await this.assertUserCanAccessGradebooks(
      actorUserId,
      context.school_id,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    if (context.workflow_status !== 'SUBMITTED') {
      throw new ConflictException(
        `Only submitted gradebooks can be approved. Current status: ${context.workflow_status}.`,
      );
    }

    const result = await this.db.query<{
      id: string;
      workflow_status: string;
      approved_at: Date;
    }>(
      `
      UPDATE gradebooks
      SET
        workflow_status = 'APPROVED',
        status = 'APPROVED',
        approved_at = NOW(),
        approved_by_user_id = $2,
        rejected_at = NULL,
        rejected_by_user_id = NULL,
        rejection_reason = NULL,
        rejection_reason_i18n = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, workflow_status, approved_at
      `,
      [gradebookId, actorUserId],
    );

    await this.platformActivityService.record({
      eventType: 'GRADEBOOK_APPROVED',
      actorType: platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
      actorUserId,
      schoolId: context.school_id,
      summary: `Gradebook approved for section ${context.section_code}, subject ${context.subject_code}.`,
      payload: {
        gradebookId,
        sectionId: context.section_id,
        subjectId: context.subject_id,
        gradingPeriodId: context.grading_period_id,
      },
    });

    return result.rows[0];
  }

  async rejectGradebook(
    gradebookId: string,
    reason: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const context = await this.getWorkflowGradebookContext(gradebookId);

    await this.assertUserCanAccessGradebooks(
      actorUserId,
      context.school_id,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    if (context.workflow_status !== 'SUBMITTED') {
      throw new ConflictException(
        `Only submitted gradebooks can be rejected. Current status: ${context.workflow_status}.`,
      );
    }

    const result = await this.db.query<{
      id: string;
      workflow_status: string;
      rejected_at: Date;
      rejection_reason: string;
    }>(
      `
      UPDATE gradebooks
      SET
        workflow_status = 'REJECTED',
        status = 'REJECTED',
        rejected_at = NOW(),
        rejected_by_user_id = $2,
        rejection_reason = $3,
        rejection_reason_i18n = jsonb_build_object('fr', $3::text, 'en', $3::text),
        approved_at = NULL,
        approved_by_user_id = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, workflow_status, rejected_at, rejection_reason
      `,
      [gradebookId, actorUserId, reason.trim()],
    );

    await this.platformActivityService.record({
      eventType: 'GRADEBOOK_REJECTED',
      actorType: platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
      actorUserId,
      schoolId: context.school_id,
      summary: `Gradebook rejected for section ${context.section_code}, subject ${context.subject_code}.`,
      payload: {
        gradebookId,
        sectionId: context.section_id,
        subjectId: context.subject_id,
        gradingPeriodId: context.grading_period_id,
        reason: reason.trim(),
      },
    });

    return result.rows[0];
  }
  async publishGradebook(
    gradebookId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const context = await this.getWorkflowGradebookContext(gradebookId);

    await this.assertUserCanAccessGradebooks(
      actorUserId,
      context.school_id,
      platformRole,
      ['SCHOOL_ADMIN'],
    );

    if (context.workflow_status !== 'APPROVED') {
      throw new ConflictException(
        `Only approved gradebooks can be published. Current status: ${context.workflow_status}.`,
      );
    }

    const result = await this.db.query<{
      id: string;
      workflow_status: string;
      published_at: Date;
    }>(
      `
      UPDATE gradebooks
      SET
        workflow_status = 'PUBLISHED',
        status = 'PUBLISHED',
        published_at = NOW(),
        published_by_user_id = $2,
        updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, workflow_status, published_at
      `,
      [gradebookId, actorUserId],
    );

    await this.platformActivityService.record({
      eventType: 'GRADEBOOK_PUBLISHED',
      actorType: platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
      actorUserId,
      schoolId: context.school_id,
      summary: `Gradebook published for section ${context.section_code}, subject ${context.subject_code}.`,
      payload: {
        gradebookId,
        sectionId: context.section_id,
        subjectId: context.subject_id,
        gradingPeriodId: context.grading_period_id,
      },
    });

    return result.rows[0];
  }

  async getReportCardReadiness(
    schoolId: string,
    gradingPeriodId?: string,
    allowedSectionIds?: string[],
    allowedSubjectCodes?: string[],
  ) {
    const overview = await this.getOverview(
      schoolId,
      gradingPeriodId,
      allowedSectionIds,
      allowedSubjectCodes,
    );

    if (!overview.gradingPeriod) {
      return {
        schoolId,
        gradingPeriod: null,
        isReadyForReportCards: false,
        isReadyForPublishing: false,
        summary: {
          totalExpected: 0,
          missing: 0,
          draft: 0,
          submitted: 0,
          approved: 0,
          rejected: 0,
          published: 0,
          publishable: 0,
          blockingCount: 0,
          publishedCoveragePercent: 0,
          approvedOrPublishedCoveragePercent: 0,
        },
        blockingIssues: ['No active grading period found.'],
        rows: [],
      };
    }

    const totalExpected = overview.summary.totalExpected;
    const missing = overview.summary.missing;
    const draft = overview.summary.draft;
    const submitted = overview.summary.submitted;
    const approved = overview.summary.approved;
    const rejected = overview.summary.rejected;
    const published = overview.summary.published;

    const publishable = approved;
    const blockingCount = missing + draft + submitted + rejected + approved;

    const publishedCoveragePercent =
      totalExpected > 0
        ? Number(((published / totalExpected) * 100).toFixed(0))
        : 0;

    const approvedOrPublishedCoveragePercent =
      totalExpected > 0
        ? Number((((approved + published) / totalExpected) * 100).toFixed(0))
        : 0;

    const blockingIssues: string[] = [];

    if (missing > 0) {
      blockingIssues.push(`${missing} gradebook(s) are missing.`);
    }

    if (draft > 0) {
      blockingIssues.push(`${draft} gradebook(s) are still in draft.`);
    }

    if (submitted > 0) {
      blockingIssues.push(`${submitted} gradebook(s) are awaiting approval.`);
    }

    if (rejected > 0) {
      blockingIssues.push(
        `${rejected} gradebook(s) were rejected and need correction.`,
      );
    }

    if (approved > 0) {
      blockingIssues.push(
        `${approved} approved gradebook(s) still need publishing.`,
      );
    }

    const isReadyForPublishing =
      totalExpected > 0 &&
      missing === 0 &&
      draft === 0 &&
      submitted === 0 &&
      rejected === 0 &&
      approved > 0;

    const isReadyForReportCards =
      totalExpected > 0 && published === totalExpected;

    return {
      schoolId,
      gradingPeriod: overview.gradingPeriod,
      isReadyForReportCards,
      isReadyForPublishing,
      summary: {
        totalExpected,
        missing,
        draft,
        submitted,
        approved,
        rejected,
        published,
        publishable,
        blockingCount,
        publishedCoveragePercent,
        approvedOrPublishedCoveragePercent,
      },
      blockingIssues,
      rows: overview.rows.map((row) => ({
        sectionSubjectId: row.sectionSubjectId,
        sectionId: row.sectionId,
        gradeLevelCode: row.gradeLevelCode,
        gradeLevelNameI18n: row.gradeLevelNameI18n,
        sectionCode: row.sectionCode,
        sectionNameI18n: row.sectionNameI18n,
        subjectCode: row.subjectCode,
        subjectNameI18n: row.subjectNameI18n,
        gradebookId: row.gradebookId,
        workflowStatus: row.workflowStatus,
        blocksReportCards: row.workflowStatus !== 'PUBLISHED',
        canPublish: row.workflowStatus === 'APPROVED',
      })),
    };
  }
}
