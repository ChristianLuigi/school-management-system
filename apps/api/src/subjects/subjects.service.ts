import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

type SubjectRow = {
  id: string;
  school_id: string;
  code: string;
  name_i18n: Record<string, string>;
  default_coefficient: string;
  is_core: boolean;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class SubjectsService {
  constructor(private readonly db: DbService) {}

  async findAll(schoolId: string): Promise<SubjectRow[]> {
    const result = await this.db.query<SubjectRow>(
      `
      SELECT
        id,
        school_id,
        code,
        name_i18n,
        default_coefficient,
        is_core,
        created_at,
        updated_at
      FROM subjects
      WHERE school_id = $1
        AND deleted_at IS NULL
      ORDER BY code ASC
      `,
      [schoolId],
    );

    return result.rows;
  }
}