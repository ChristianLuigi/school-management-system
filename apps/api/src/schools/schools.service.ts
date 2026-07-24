import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

type SchoolRow = {
  id: string;
  code: string;
  name: string;
  default_locale: 'fr' | 'en';
  supported_locales: string[];
  timezone: string;
  currency_code: string;
  country_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class SchoolsService {
  constructor(private readonly db: DbService) {}

  async findAll(): Promise<SchoolRow[]> {
    const result = await this.db.query<SchoolRow>(
      `
      SELECT
        id,
        code,
        name,
        default_locale,
        supported_locales,
        timezone,
        currency_code,
        country_code,
        is_active,
        created_at,
        updated_at
      FROM schools
      WHERE deleted_at IS NULL
      ORDER BY name ASC
      `,
    );

    return result.rows;
  }

  async findOne(id: string): Promise<SchoolRow> {
    const result = await this.db.query<SchoolRow>(
      `
      SELECT
        id,
        code,
        name,
        default_locale,
        supported_locales,
        timezone,
        currency_code,
        country_code,
        is_active,
        created_at,
        updated_at
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [id],
    );

    const school = result.rows[0];

    if (!school) {
      throw new NotFoundException(`School ${id} not found.`);
    }

    return school;
  }
}