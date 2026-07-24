import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateFeePlanDto } from './dto/create-fee-plan.dto';

type FeePlanRow = {
  id: string;
  school_id: string;
  name_i18n: Record<string, string>;
  fee_type: 'TUITION' | 'REGISTRATION' | 'TRANSPORT';
  billing_frequency: 'MONTHLY' | 'TRIMESTER' | 'ONE_TIME';
  grade_level_id: string | null;
  default_amount: string;
  currency_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class FeePlansService {
  constructor(private readonly db: DbService) {}

  async findAll(schoolId: string): Promise<FeePlanRow[]> {
    const result = await this.db.query<FeePlanRow>(
      `
      SELECT
        id,
        school_id,
        name_i18n,
        fee_type,
        billing_frequency,
        grade_level_id,
        default_amount,
        currency_code,
        is_active,
        created_at,
        updated_at
      FROM fee_plans
      WHERE school_id = $1
        AND deleted_at IS NULL
      ORDER BY fee_type ASC, created_at ASC
      `,
      [schoolId],
    );

    return result.rows;
  }

  async create(dto: CreateFeePlanDto): Promise<FeePlanRow> {
    const schoolCheck = await this.db.query(
      `
      SELECT id
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [dto.schoolId],
    );

    if (schoolCheck.rows.length === 0) {
      throw new NotFoundException(`School ${dto.schoolId} not found.`);
    }

    const result = await this.db.query<FeePlanRow>(
      `
      INSERT INTO fee_plans (
        school_id,
        name_i18n,
        fee_type,
        billing_frequency,
        grade_level_id,
        default_amount,
        currency_code,
        is_active
      )
      VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        school_id,
        name_i18n,
        fee_type,
        billing_frequency,
        grade_level_id,
        default_amount,
        currency_code,
        is_active,
        created_at,
        updated_at
      `,
      [
        dto.schoolId,
        JSON.stringify(dto.nameI18n),
        dto.feeType,
        dto.billingFrequency,
        dto.gradeLevelId ?? null,
        dto.defaultAmount,
        dto.currencyCode,
        dto.isActive ?? true,
      ],
    );

    return result.rows[0];
  }
}