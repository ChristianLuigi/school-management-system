import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

type EnrollmentRow = {
  id: string;
  student_id: string;
  academic_year_id: string;
  grade_level_id: string;
  section_id: string;
  enrollment_status: 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN';
  start_date: string;
  end_date: string | null;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
  grade_level_code: string;
  grade_level_name_i18n: Record<string, string>;
  section_code: string;
  section_name_i18n: Record<string, string>;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class EnrollmentsService {
  constructor(private readonly db: DbService) {}

  async findAll(
    academicYearId: string,
    sectionId?: string,
  ): Promise<EnrollmentRow[]> {
    const useSectionFilter = Boolean(sectionId);

    const result = await this.db.query<EnrollmentRow>(
      `
      SELECT
        e.id,
        e.student_id,
        e.academic_year_id,
        e.grade_level_id,
        e.section_id,
        e.enrollment_status,
        e.start_date,
        e.end_date,
        s.student_number,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n,
        sec.code AS section_code,
        sec.name_i18n AS section_name_i18n,
        e.created_at,
        e.updated_at
      FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN grade_levels gl ON gl.id = e.grade_level_id
      JOIN sections sec ON sec.id = e.section_id
      WHERE e.academic_year_id = $1
        AND e.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND gl.deleted_at IS NULL
        AND sec.deleted_at IS NULL
        ${useSectionFilter ? 'AND e.section_id = $2' : ''}
      ORDER BY s.last_name ASC, s.first_name ASC
      `,
      useSectionFilter ? [academicYearId, sectionId] : [academicYearId],
    );

    return result.rows;
  }
}