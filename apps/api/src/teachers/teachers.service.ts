import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

type TeacherRow = {
  id: string;
  school_id: string;
  user_id: string;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email_override: string | null;
  is_active: boolean;
  email: string;
  preferred_locale: 'fr' | 'en';
  created_at: string;
  updated_at: string;
};

@Injectable()
export class TeachersService {
  constructor(private readonly db: DbService) {}

  async findAll(schoolId: string): Promise<TeacherRow[]> {
    const result = await this.db.query<TeacherRow>(
      `
      SELECT
        t.id,
        t.school_id,
        t.user_id,
        t.employee_code,
        t.first_name,
        t.last_name,
        t.phone,
        t.email_override,
        t.is_active,
        u.email,
        u.preferred_locale,
        t.created_at,
        t.updated_at
      FROM teachers t
      JOIN users u ON u.id = t.user_id
      WHERE t.school_id = $1
        AND t.deleted_at IS NULL
        AND u.deleted_at IS NULL
      ORDER BY t.last_name ASC, t.first_name ASC
      `,
      [schoolId],
    );

    return result.rows;
  }
}