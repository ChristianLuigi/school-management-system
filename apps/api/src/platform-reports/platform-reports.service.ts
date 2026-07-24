import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class PlatformReportsService {
  constructor(private readonly db: DbService) {}

  async exportSchoolsCsv() {
    const result = await this.db.query<{
      code: string;
      name: string;
      status: string;
      management_mode: string;
      default_locale: string;
      timezone: string;
      currency_code: string;
      country_code: string;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        code,
        name,
        status::text AS status,
        management_mode::text AS management_mode,
        default_locale,
        timezone,
        currency_code,
        country_code,
        created_at::text,
        updated_at::text
      FROM schools
      WHERE deleted_at IS NULL
      ORDER BY name ASC
      `,
    );

    return this.toCsv(
      [
        'code',
        'name',
        'status',
        'management_mode',
        'default_locale',
        'timezone',
        'currency_code',
        'country_code',
        'created_at',
        'updated_at',
      ],
      result.rows.map((row) => [
        row.code,
        row.name,
        row.status,
        row.management_mode,
        row.default_locale,
        row.timezone,
        row.currency_code,
        row.country_code,
        row.created_at,
        row.updated_at,
      ]),
    );
  }

  async exportOnboardingCsv() {
    const result = await this.db.query<{
      school_name: string;
      school_code: string;
      school_status: string;
      management_mode: string;
      school_admins: string;
      admin_logins: string;
      levels: string;
      academic_years: string;
      grading_periods: string;
      grade_levels: string;
      sections: string;
      last_activity_at: string | null;
    }>(
      `
      SELECT
        s.name AS school_name,
        s.code AS school_code,
        s.status::text AS school_status,
        s.management_mode::text AS management_mode,

        (
          SELECT COUNT(DISTINCT sm.id)
          FROM school_memberships sm
          JOIN school_membership_roles smr
            ON smr.school_membership_id = sm.id
           AND smr.deleted_at IS NULL
          WHERE sm.school_id = s.id
            AND sm.deleted_at IS NULL
            AND sm.membership_status = 'ACTIVE'
            AND smr.role = 'SCHOOL_ADMIN'
        )::text AS school_admins,

        (
          SELECT COUNT(DISTINCT sm.id)
          FROM school_memberships sm
          JOIN school_membership_roles smr
            ON smr.school_membership_id = sm.id
           AND smr.deleted_at IS NULL
          JOIN users u ON u.id = sm.user_id
          WHERE sm.school_id = s.id
            AND sm.deleted_at IS NULL
            AND u.deleted_at IS NULL
            AND sm.membership_status = 'ACTIVE'
            AND smr.role = 'SCHOOL_ADMIN'
            AND u.last_login_at IS NOT NULL
        )::text AS admin_logins,

        (
          SELECT COUNT(*)
          FROM school_levels sl
          WHERE sl.school_id = s.id
            AND sl.deleted_at IS NULL
            AND sl.is_active = TRUE
        )::text AS levels,

        (
          SELECT COUNT(*)
          FROM academic_years ay
          WHERE ay.school_id = s.id
            AND ay.deleted_at IS NULL
        )::text AS academic_years,

        (
          SELECT COUNT(*)
          FROM grading_periods gp
          JOIN academic_years ay ON ay.id = gp.academic_year_id
          WHERE ay.school_id = s.id
            AND ay.deleted_at IS NULL
            AND gp.deleted_at IS NULL
        )::text AS grading_periods,

        (
          SELECT COUNT(*)
          FROM grade_levels gl
          WHERE gl.school_id = s.id
            AND gl.deleted_at IS NULL
        )::text AS grade_levels,

        (
          SELECT COUNT(*)
          FROM sections se
          WHERE se.school_id = s.id
            AND se.deleted_at IS NULL
        )::text AS sections,

        GREATEST(
          s.updated_at,
          COALESCE((
            SELECT MAX(u.last_login_at)
            FROM school_memberships sm
            JOIN users u ON u.id = sm.user_id
            WHERE sm.school_id = s.id
              AND sm.deleted_at IS NULL
              AND u.deleted_at IS NULL
          ), s.updated_at),
          COALESCE((
            SELECT MAX(sm.updated_at)
            FROM school_memberships sm
            WHERE sm.school_id = s.id
              AND sm.deleted_at IS NULL
          ), s.updated_at),
          COALESCE((
            SELECT MAX(ay.created_at)
            FROM academic_years ay
            WHERE ay.school_id = s.id
              AND ay.deleted_at IS NULL
          ), s.updated_at)
        )::text AS last_activity_at
      FROM schools s
      WHERE s.deleted_at IS NULL
      ORDER BY s.name ASC
      `,
    );

    const rows = result.rows.map((row) => {
      const checks = [
        Number(row.school_admins) > 0,
        Number(row.admin_logins) > 0,
        Number(row.levels) > 0,
        Number(row.academic_years) > 0,
        Number(row.grading_periods) > 0,
        Number(row.grade_levels) > 0,
        Number(row.sections) > 0,
        row.school_status === 'ACTIVE',
      ];

      const completionPercent = Number(
        ((checks.filter(Boolean).length / checks.length) * 100).toFixed(0),
      );

      let actionNeeded = 'None';

      if (row.school_status === 'SUSPENDED') {
        actionNeeded = 'Review suspended school';
      } else if (Number(row.school_admins) === 0) {
        actionNeeded = 'Create school admin';
      } else if (Number(row.admin_logins) === 0) {
        actionNeeded = 'School admin has not logged in';
      } else if (Number(row.levels) === 0) {
        actionNeeded = 'Configure school levels';
      } else if (Number(row.academic_years) === 0) {
        actionNeeded = 'Run school setup';
      } else if (Number(row.grading_periods) === 0) {
        actionNeeded = 'Create grading periods';
      } else if (Number(row.grade_levels) === 0) {
        actionNeeded = 'Create grade levels';
      } else if (Number(row.sections) === 0) {
        actionNeeded = 'Create sections';
      } else if (row.school_status !== 'ACTIVE') {
        actionNeeded = 'Activate school';
      }

      return [
        row.school_name,
        row.school_code,
        row.school_status,
        row.management_mode,
        row.school_admins,
        row.admin_logins,
        row.levels,
        row.academic_years,
        row.grading_periods,
        row.grade_levels,
        row.sections,
        completionPercent.toString(),
        actionNeeded,
        row.last_activity_at ?? '',
      ];
    });

    return this.toCsv(
      [
        'school_name',
        'school_code',
        'school_status',
        'management_mode',
        'school_admins',
        'admin_logins',
        'levels',
        'academic_years',
        'grading_periods',
        'grade_levels',
        'sections',
        'completion_percent',
        'action_needed',
        'last_activity_at',
      ],
      rows,
    );
  }

  async exportStaffCsv() {
    const result = await this.db.query<{
      school_name: string;
      school_code: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      membership_status: string;
      job_title: string | null;
      roles: string[];
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        s.name AS school_name,
        s.code AS school_code,
        u.email,
        u.first_name,
        u.last_name,
        sm.membership_status::text AS membership_status,
        sm.job_title,
        COALESCE(
          ARRAY_AGG(smr.role::text) FILTER (WHERE smr.deleted_at IS NULL),
          ARRAY[]::text[]
        ) AS roles,
        sm.created_at::text,
        sm.updated_at::text
      FROM school_memberships sm
      JOIN users u ON u.id = sm.user_id
      JOIN schools s ON s.id = sm.school_id
      LEFT JOIN school_membership_roles smr
        ON smr.school_membership_id = sm.id
      WHERE sm.deleted_at IS NULL
        AND u.deleted_at IS NULL
        AND s.deleted_at IS NULL
      GROUP BY
        s.name, s.code, u.email, u.first_name, u.last_name,
        sm.membership_status, sm.job_title, sm.created_at, sm.updated_at
      ORDER BY s.name ASC, u.email ASC
      `,
    );

    return this.toCsv(
      [
        'school_name',
        'school_code',
        'email',
        'first_name',
        'last_name',
        'membership_status',
        'job_title',
        'roles',
        'created_at',
        'updated_at',
      ],
      result.rows.map((row) => [
        row.school_name,
        row.school_code,
        row.email,
        row.first_name ?? '',
        row.last_name ?? '',
        row.membership_status,
        row.job_title ?? '',
        row.roles.join(' | '),
        row.created_at,
        row.updated_at,
      ]),
    );
  }

  async exportActivityCsv() {
    const result = await this.db.query<{
      event_type: string;
      actor_type: string;
      school_name: string | null;
      summary: string;
      created_at: string;
    }>(
      `
      SELECT
        pal.event_type,
        pal.actor_type,
        s.name AS school_name,
        pal.summary,
        pal.created_at::text
      FROM platform_activity_logs pal
      LEFT JOIN schools s ON s.id = pal.school_id
      ORDER BY pal.created_at DESC
      LIMIT 1000
      `,
    );

    return this.toCsv(
      ['event_type', 'actor_type', 'school_name', 'summary', 'created_at'],
      result.rows.map((row) => [
        row.event_type,
        row.actor_type,
        row.school_name ?? '',
        row.summary,
        row.created_at,
      ]),
    );
  }

  private toCsv(headers: string[], rows: string[][]) {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

    return [
      headers.map(escape).join(','),
      ...rows.map((row) => row.map((cell) => escape(String(cell ?? ''))).join(',')),
    ].join('\n');
  }
}
