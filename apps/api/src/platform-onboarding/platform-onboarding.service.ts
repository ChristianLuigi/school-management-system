import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ListPlatformOnboardingDto } from './dto/list-platform-onboarding.dto';

type OnboardingQueryRow = {
  school_id: string;
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
};

@Injectable()
export class PlatformOnboardingService {
  constructor(private readonly db: DbService) {}

  async list(query: ListPlatformOnboardingDto) {
    const values: unknown[] = [];
    const where: string[] = ['s.deleted_at IS NULL'];

    if (query.status) {
      values.push(query.status);
      where.push(`s.status = $${values.length}`);
    }

    if (query.managementMode) {
      values.push(query.managementMode);
      where.push(`s.management_mode = $${values.length}`);
    }

    if (query.search?.trim()) {
      values.push(`%${query.search.trim().toLowerCase()}%`);
      where.push(
        `(LOWER(s.name) LIKE $${values.length} OR LOWER(s.code) LIKE $${values.length})`,
      );
    }

    const result = await this.db.query<OnboardingQueryRow>(
      `
      SELECT
        s.id AS school_id,
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
      WHERE ${where.join(' AND ')}
      ORDER BY s.name ASC
      `,
      values,
    );

    const rows = result.rows.map((row) => {
      const schoolAdmins = Number(row.school_admins);
      const adminLogins = Number(row.admin_logins);
      const levels = Number(row.levels);
      const academicYears = Number(row.academic_years);
      const gradingPeriods = Number(row.grading_periods);
      const gradeLevels = Number(row.grade_levels);
      const sections = Number(row.sections);

      const checks = [
        schoolAdmins > 0,
        adminLogins > 0,
        levels > 0,
        academicYears > 0,
        gradingPeriods > 0,
        gradeLevels > 0,
        sections > 0,
        row.school_status === 'ACTIVE',
      ];

      const completionPercent = Number(
        ((checks.filter(Boolean).length / checks.length) * 100).toFixed(0),
      );

      let actionNeeded = 'None';

      if (row.school_status === 'SUSPENDED') {
        actionNeeded = 'Review suspended school';
      } else if (schoolAdmins === 0) {
        actionNeeded = 'Create school admin';
      } else if (adminLogins === 0) {
        actionNeeded = 'School admin has not logged in';
      } else if (levels === 0) {
        actionNeeded = 'Configure school levels';
      } else if (academicYears === 0) {
        actionNeeded = 'Run school setup';
      } else if (gradingPeriods === 0) {
        actionNeeded = 'Create grading periods';
      } else if (gradeLevels === 0) {
        actionNeeded = 'Create grade levels';
      } else if (sections === 0) {
        actionNeeded = 'Create sections';
      } else if (row.school_status !== 'ACTIVE') {
        actionNeeded = 'Activate school';
      }

      return {
        schoolId: row.school_id,
        schoolName: row.school_name,
        schoolCode: row.school_code,
        schoolStatus: row.school_status,
        managementMode: row.management_mode,
        schoolAdmins,
        adminLogins,
        levels,
        academicYears,
        gradingPeriods,
        gradeLevels,
        sections,
        completionPercent,
        actionNeeded,
        needsAttention: actionNeeded !== 'None',
        lastActivityAt: row.last_activity_at,
      };
    });

    const filtered =
      query.attentionOnly === 'true'
        ? rows.filter((row) => row.needsAttention)
        : rows;

    return {
      summary: {
        totalSchools: filtered.length,
        needingAttention: filtered.filter((row) => row.needsAttention).length,
        complete: filtered.filter((row) => row.completionPercent === 100).length,
        adminNotLoggedIn: filtered.filter(
          (row) => row.schoolAdmins > 0 && row.adminLogins === 0,
        ).length,
      },
      rows: filtered,
    };
  }
}
