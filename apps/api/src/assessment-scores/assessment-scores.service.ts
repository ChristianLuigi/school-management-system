import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { BulkUpsertAssessmentScoresDto } from './dto/bulk-upsert-assessment-scores.dto';

type AssessmentScoreRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  raw_score: string;
  teacher_comment_i18n: Record<string, string> | null;
  entered_by_user_id: string;
  entered_at: string;
  last_modified_by_user_id: string | null;
  last_modified_at: string | null;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class AssessmentScoresService {
  constructor(private readonly db: DbService) {}

  async findAll(assessmentId: string): Promise<AssessmentScoreRow[]> {
    const result = await this.db.query<AssessmentScoreRow>(
      `
      SELECT
        sc.id,
        sc.assessment_id,
        sc.student_id,
        sc.raw_score,
        sc.teacher_comment_i18n,
        sc.entered_by_user_id,
        sc.entered_at,
        sc.last_modified_by_user_id,
        sc.last_modified_at,
        s.student_number,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        sc.created_at,
        sc.updated_at
      FROM assessment_scores sc
      JOIN students s ON s.id = sc.student_id
      WHERE sc.assessment_id = $1
        AND sc.deleted_at IS NULL
        AND s.deleted_at IS NULL
      ORDER BY s.last_name ASC, s.first_name ASC
      `,
      [assessmentId],
    );

    return result.rows;
  }

  async bulkUpsert(dto: BulkUpsertAssessmentScoresDto) {
    return this.db.withTransaction(async (client) => {
      this.ensureUniqueStudents(dto.scores.map((x) => x.studentId));

      const assessmentContext = await this.getAssessmentContext(
        client,
        dto.assessmentId,
      );

      if (!assessmentContext) {
        throw new NotFoundException(`Assessment ${dto.assessmentId} not found.`);
      }

      if (
        assessmentContext.gradebook_status !== 'DRAFT' &&
        assessmentContext.gradebook_status !== 'REJECTED'
      ) {
        throw new BadRequestException(
          'Scores can only be changed when the gradebook is in DRAFT or REJECTED status.',
        );
      }

      const validStudentIds = await this.getValidStudentIdsForAssessment(
        client,
        dto.assessmentId,
      );

      for (const score of dto.scores) {
        if (!validStudentIds.has(score.studentId)) {
          throw new BadRequestException(
            `Student ${score.studentId} is not valid for this assessment's section.`,
          );
        }

        if (score.rawScore > Number(assessmentContext.max_points_possible)) {
          throw new BadRequestException(
            `Raw score ${score.rawScore} exceeds max points ${assessmentContext.max_points_possible}.`,
          );
        }

        await client.query(
          `
          INSERT INTO assessment_scores (
            assessment_id,
            student_id,
            raw_score,
            teacher_comment_i18n,
            entered_by_user_id,
            entered_at,
            last_modified_by_user_id,
            last_modified_at
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, NOW(), NULL, NULL)
          ON CONFLICT (assessment_id, student_id)
          DO UPDATE SET
            raw_score = EXCLUDED.raw_score,
            teacher_comment_i18n = EXCLUDED.teacher_comment_i18n,
            last_modified_by_user_id = $5,
            last_modified_at = NOW(),
            updated_at = NOW()
          `,
          [
            dto.assessmentId,
            score.studentId,
            score.rawScore,
            score.teacherCommentI18n
              ? JSON.stringify(score.teacherCommentI18n)
              : null,
            dto.enteredByUserId,
          ],
        );
      }

      const scores = await this.findAll(dto.assessmentId);

      return {
        assessmentId: dto.assessmentId,
        count: scores.length,
        scores,
      };
    });
  }

  private ensureUniqueStudents(studentIds: string[]) {
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException(
        'Duplicate student IDs were found in the score payload.',
      );
    }
  }

  private async getAssessmentContext(client: PoolClient, assessmentId: string) {
    const result = await client.query<{
      assessment_id: string;
      max_points_possible: string;
      gradebook_status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
    }>(
      `
      SELECT
        a.id AS assessment_id,
        a.max_points_possible,
        gb.status AS gradebook_status
      FROM assessments a
      JOIN gradebooks gb ON gb.id = a.gradebook_id
      WHERE a.id = $1
        AND a.deleted_at IS NULL
        AND gb.deleted_at IS NULL
      LIMIT 1
      `,
      [assessmentId],
    );

    return result.rows[0] ?? null;
  }

  private async getValidStudentIdsForAssessment(
    client: PoolClient,
    assessmentId: string,
  ): Promise<Set<string>> {
    const result = await client.query<{ student_id: string }>(
      `
      SELECT s.id AS student_id
      FROM assessments a
      JOIN gradebooks gb ON gb.id = a.gradebook_id
      JOIN section_subjects ss ON ss.id = gb.section_subject_id
      JOIN enrollments e ON e.section_id = ss.section_id
      JOIN students s ON s.id = e.student_id
      WHERE a.id = $1
        AND a.deleted_at IS NULL
        AND gb.deleted_at IS NULL
        AND ss.deleted_at IS NULL
        AND e.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND e.enrollment_status = 'ACTIVE'
      `,
      [assessmentId],
    );

    return new Set(result.rows.map((r) => r.student_id));
  }
}