import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

type StudentRow = {
  id: string;
  school_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  admission_date: string | null;
  status: 'ACTIVE' | 'WITHDRAWN' | 'GRADUATED';
  created_at: string;
  updated_at: string;
};

@Injectable()
export class StudentsService {
  constructor(private readonly db: DbService) {}

  async findAll(schoolId: string): Promise<StudentRow[]> {
    const result = await this.db.query<StudentRow>(
      `
      SELECT
        id,
        school_id,
        student_number,
        first_name,
        last_name,
        date_of_birth,
        gender,
        admission_date,
        status,
        created_at,
        updated_at
      FROM students
      WHERE school_id = $1
        AND deleted_at IS NULL
      ORDER BY last_name ASC, first_name ASC
      `,
      [schoolId],
    );

    return result.rows;
  }
}