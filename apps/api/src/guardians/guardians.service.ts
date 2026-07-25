import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

type GuardianRow = {
  id: string;
  school_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  secondary_phone: string | null;
  email_override: string | null;
  receive_attendance_alerts: boolean;
  receive_finance_alerts: boolean;
  email: string;
  preferred_locale: 'fr' | 'en';
  created_at: string;
  updated_at: string;
};

@Injectable()
export class GuardiansService {
  constructor(private readonly db: DbService) {}

  async findAll(schoolId: string): Promise<GuardianRow[]> {
    const result = await this.db.query<GuardianRow>(
      `
      SELECT
        g.id,
        g.school_id,
        g.user_id,
        g.first_name,
        g.last_name,
        g.phone,
        g.secondary_phone,
        g.email_override,
        g.receive_attendance_alerts,
        g.receive_finance_alerts,
        u.email,
        u.preferred_locale,
        g.created_at,
        g.updated_at
      FROM guardians g
      JOIN users u ON u.id = g.user_id
      WHERE g.school_id = $1
        AND g.deleted_at IS NULL
        AND u.deleted_at IS NULL
      ORDER BY g.last_name ASC, g.first_name ASC
      `,
      [schoolId],
    );

    return result.rows;
  }
}