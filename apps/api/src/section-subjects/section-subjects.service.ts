import { Injectable } from '@nestjs/common';
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
    sectionId?: string,
  ): Promise<SectionSubjectRow[]> {
    const useSectionFilter = Boolean(sectionId);

    const result = await this.db.query<SectionSubjectRow>(
      `
      SELECT
        ss.id,
        ss.school_id,
        ss.academic_year_id,
        ss.section_id,
        ss.subject_id,
        ss.teacher_id,
        ss.coefficient,
        ss.grading_configuration_id,
        ss.is_active,
        sec.code AS section_code,
        sec.name_i18n AS section_name_i18n,
        sub.code AS subject_code,
        sub.name_i18n AS subject_name_i18n,
        t.first_name AS teacher_first_name,
        t.last_name AS teacher_last_name,
        ss.created_at,
        ss.updated_at
      FROM section_subjects ss
      JOIN sections sec ON sec.id = ss.section_id
      JOIN subjects sub ON sub.id = ss.subject_id
      JOIN teachers t ON t.id = ss.teacher_id
      WHERE ss.academic_year_id = $1
        AND ss.deleted_at IS NULL
        AND sec.deleted_at IS NULL
        AND sub.deleted_at IS NULL
        AND t.deleted_at IS NULL
        ${useSectionFilter ? 'AND ss.section_id = $2' : ''}
      ORDER BY sec.code ASC, sub.code ASC
      `,
      useSectionFilter ? [academicYearId, sectionId] : [academicYearId],
    );

    return result.rows;
  }
}
