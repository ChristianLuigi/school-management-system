import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateStudentDiscountDto } from './dto/create-student-discount.dto';

type StudentDiscountRow = {
  id: string;
  student_id: string;
  name_i18n: Record<string, string>;
  discount_type: 'PERCENT' | 'FIXED';
  value: string;
  scope: 'TUITION' | 'TRANSPORT' | 'ALL';
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class StudentDiscountsService {
  constructor(private readonly db: DbService) {}

  async findAll(studentId: string): Promise<StudentDiscountRow[]> {
    const result = await this.db.query<StudentDiscountRow>(
      `
      SELECT
        id,
        student_id,
        name_i18n,
        discount_type,
        value,
        scope,
        start_date,
        end_date,
        created_at,
        updated_at
      FROM student_discounts
      WHERE student_id = $1
        AND deleted_at IS NULL
      ORDER BY start_date DESC, created_at DESC
      `,
      [studentId],
    );

    return result.rows;
  }

  async create(dto: CreateStudentDiscountDto): Promise<StudentDiscountRow> {
    if (dto.endDate && dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'Discount end date cannot be before start date.',
      );
    }

    const studentCheck = await this.db.query(
      `
      SELECT id
      FROM students
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [dto.studentId],
    );

    if (studentCheck.rows.length === 0) {
      throw new NotFoundException(`Student ${dto.studentId} not found.`);
    }

    if (dto.discountType === 'PERCENT' && dto.value > 100) {
      throw new BadRequestException(
        'Percentage discount cannot exceed 100.',
      );
    }

    const result = await this.db.query<StudentDiscountRow>(
      `
      INSERT INTO student_discounts (
        student_id,
        name_i18n,
        discount_type,
        value,
        scope,
        start_date,
        end_date
      )
      VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7)
      RETURNING
        id,
        student_id,
        name_i18n,
        discount_type,
        value,
        scope,
        start_date,
        end_date,
        created_at,
        updated_at
      `,
      [
        dto.studentId,
        JSON.stringify(dto.nameI18n),
        dto.discountType,
        dto.value,
        dto.scope,
        dto.startDate,
        dto.endDate ?? null,
      ],
    );

    return result.rows[0];
  }
}