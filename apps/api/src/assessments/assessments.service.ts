import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';

type AssessmentRow = {
  id: string;
  gradebook_id: string;
  title_i18n: Record<string, string>;
  assessment_type: 'HOMEWORK' | 'EXAM' | 'QUIZ' | 'PARTICIPATION' | 'PROJECT';
  assessment_date: string;
  max_points_possible: string;
  weight_percent: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class AssessmentsService {
  constructor(private readonly db: DbService) {}

  async findAll(gradebookId: string): Promise<AssessmentRow[]> {
    const result = await this.db.query<AssessmentRow>(
      `
      SELECT
        id,
        gradebook_id,
        title_i18n,
        assessment_type,
        assessment_date,
        max_points_possible,
        weight_percent,
        display_order,
        created_at,
        updated_at
      FROM assessments
      WHERE gradebook_id = $1
        AND deleted_at IS NULL
      ORDER BY display_order ASC, assessment_date ASC, created_at ASC
      `,
      [gradebookId],
    );

    return result.rows;
  }

  async create(dto: CreateAssessmentDto): Promise<AssessmentRow> {
    const gradebookCheck = await this.db.query<{ id: string; status: string }>(
      `
      SELECT id, status
      FROM gradebooks
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [dto.gradebookId],
    );

    const gradebook = gradebookCheck.rows[0];

    if (!gradebook) {
      throw new NotFoundException(`Gradebook ${dto.gradebookId} not found.`);
    }

    if (gradebook.status !== 'DRAFT' && gradebook.status !== 'REJECTED') {
      throw new BadRequestException(
        'Assessments can only be added when the gradebook is in DRAFT or REJECTED status.',
      );
    }

    const displayOrder =
      dto.displayOrder ??
      (
        await this.db.query<{ next_order: number }>(
          `
          SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
          FROM assessments
          WHERE gradebook_id = $1
            AND deleted_at IS NULL
          `,
          [dto.gradebookId],
        )
      ).rows[0].next_order;

    const result = await this.db.query<AssessmentRow>(
      `
      INSERT INTO assessments (
        gradebook_id,
        title_i18n,
        assessment_type,
        assessment_date,
        max_points_possible,
        weight_percent,
        display_order
      )
      VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7)
      RETURNING
        id,
        gradebook_id,
        title_i18n,
        assessment_type,
        assessment_date,
        max_points_possible,
        weight_percent,
        display_order,
        created_at,
        updated_at
      `,
      [
        dto.gradebookId,
        JSON.stringify(dto.titleI18n),
        dto.assessmentType,
        dto.assessmentDate,
        dto.maxPointsPossible,
        dto.weightPercent,
        displayOrder,
      ],
    );

    return result.rows[0];
  }
}
