import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PlatformDashboardTrendDto } from './dto/platform-dashboard-trend.dto';

@Injectable()
export class PlatformDashboardService {
  constructor(private readonly db: DbService) {}

  async getSummary() {
    const [
      kpisResult,
      schoolsByStatusResult,
      schoolsByManagementModeResult,
      onboardingReadinessResult,
      staffDistributionResult,
    ] = await Promise.all([
      this.db.query<{
        total_schools: string;
        active_schools: string;
        setup_schools: string;
        suspended_schools: string;
        archived_schools: string;
        total_students: string;
        total_teachers: string;
        total_finance_admins: string;
      }>(
        `
        SELECT
          (SELECT COUNT(*) FROM schools WHERE deleted_at IS NULL)::text AS total_schools,
          (SELECT COUNT(*) FROM schools WHERE deleted_at IS NULL AND status = 'ACTIVE')::text AS active_schools,
          (SELECT COUNT(*) FROM schools WHERE deleted_at IS NULL AND status = 'ACTIVE_SETUP')::text AS setup_schools,
          (SELECT COUNT(*) FROM schools WHERE deleted_at IS NULL AND status = 'SUSPENDED')::text AS suspended_schools,
          (SELECT COUNT(*) FROM schools WHERE deleted_at IS NULL AND status = 'ARCHIVED')::text AS archived_schools,
          (SELECT COUNT(*) FROM students WHERE deleted_at IS NULL)::text AS total_students,
          (
            SELECT COUNT(DISTINCT smr.school_membership_id)
            FROM school_membership_roles smr
            JOIN school_memberships sm ON sm.id = smr.school_membership_id
            WHERE smr.deleted_at IS NULL
              AND sm.deleted_at IS NULL
              AND sm.membership_status = 'ACTIVE'
              AND smr.role = 'TEACHER'
          )::text AS total_teachers,
          (
            SELECT COUNT(DISTINCT smr.school_membership_id)
            FROM school_membership_roles smr
            JOIN school_memberships sm ON sm.id = smr.school_membership_id
            WHERE smr.deleted_at IS NULL
              AND sm.deleted_at IS NULL
              AND sm.membership_status = 'ACTIVE'
              AND smr.role = 'FINANCE_ADMIN'
          )::text AS total_finance_admins
        `,
      ),

      this.db.query<{
        status: string;
        count: string;
      }>(
        `
        SELECT
          status::text AS status,
          COUNT(*)::text AS count
        FROM schools
        WHERE deleted_at IS NULL
        GROUP BY status
        ORDER BY status
        `,
      ),

      this.db.query<{
        management_mode: string;
        count: string;
      }>(
        `
        SELECT
          management_mode::text AS management_mode,
          COUNT(*)::text AS count
        FROM schools
        WHERE deleted_at IS NULL
        GROUP BY management_mode
        ORDER BY management_mode
        `,
      ),

      this.db.query<{
        school_id: string;
        school_name: string;
        levels: string;
        academic_years: string;
        grading_periods: string;
        grade_levels: string;
        sections: string;
      }>(
        `
        SELECT
          s.id AS school_id,
          s.name AS school_name,
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
              AND gp.deleted_at IS NULL
              AND ay.deleted_at IS NULL
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
          )::text AS sections
        FROM schools s
        WHERE s.deleted_at IS NULL
        ORDER BY s.name ASC
        `,
      ),

      this.db.query<{
        school_id: string;
        school_name: string;
        school_admins: string;
        teachers: string;
        finance_admins: string;
      }>(
        `
        SELECT
          s.id AS school_id,
          s.name AS school_name,
          COUNT(*) FILTER (WHERE smr.role = 'SCHOOL_ADMIN')::text AS school_admins,
          COUNT(*) FILTER (WHERE smr.role = 'TEACHER')::text AS teachers,
          COUNT(*) FILTER (WHERE smr.role = 'FINANCE_ADMIN')::text AS finance_admins
        FROM schools s
        LEFT JOIN school_memberships sm
          ON sm.school_id = s.id
         AND sm.deleted_at IS NULL
         AND sm.membership_status = 'ACTIVE'
        LEFT JOIN school_membership_roles smr
          ON smr.school_membership_id = sm.id
         AND smr.deleted_at IS NULL
        WHERE s.deleted_at IS NULL
        GROUP BY s.id, s.name
        ORDER BY s.name ASC
        `,
      ),
    ]);

    const kpis = kpisResult.rows[0];

    return {
      kpis: {
        totalSchools: Number(kpis?.total_schools ?? 0),
        activeSchools: Number(kpis?.active_schools ?? 0),
        setupSchools: Number(kpis?.setup_schools ?? 0),
        suspendedSchools: Number(kpis?.suspended_schools ?? 0),
        archivedSchools: Number(kpis?.archived_schools ?? 0),
        totalStudents: Number(kpis?.total_students ?? 0),
        totalTeachers: Number(kpis?.total_teachers ?? 0),
        totalFinanceAdmins: Number(kpis?.total_finance_admins ?? 0),
      },
      schoolsByStatus: schoolsByStatusResult.rows.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      schoolsByManagementMode: schoolsByManagementModeResult.rows.map((row) => ({
        managementMode: row.management_mode,
        count: Number(row.count),
      })),
      onboardingReadiness: onboardingReadinessResult.rows.map((row) => {
        const levels = Number(row.levels);
        const academicYears = Number(row.academic_years);
        const gradingPeriods = Number(row.grading_periods);
        const gradeLevels = Number(row.grade_levels);
        const sections = Number(row.sections);

        const checks = [
          levels > 0,
          academicYears > 0,
          gradingPeriods > 0,
          gradeLevels > 0,
          sections > 0,
        ];

        return {
          schoolId: row.school_id,
          schoolName: row.school_name,
          completionPercent: Number(
            ((checks.filter(Boolean).length / checks.length) * 100).toFixed(0),
          ),
          levels,
          academicYears,
          gradingPeriods,
          gradeLevels,
          sections,
        };
      }),
      staffDistribution: staffDistributionResult.rows.map((row) => ({
        schoolId: row.school_id,
        schoolName: row.school_name,
        schoolAdmins: Number(row.school_admins),
        teachers: Number(row.teachers),
        financeAdmins: Number(row.finance_admins),
      })),
    };
  }

  async getTrend(query: PlatformDashboardTrendDto) {
    const config = this.getRangeConfig(query.range);

    const values: unknown[] = [
      config.start,
      config.end,
      config.bucket,
      config.step,
      config.labelFormat,
    ];

    let sourceSql = '';
    let schoolFilterSql = '';
    let modeFilterSql = '';

    if (query.schoolId) {
      values.push(query.schoolId);
      schoolFilterSql = ` AND source_school_id = $${values.length} `;
    }

    if (query.managementMode) {
      values.push(query.managementMode);
      modeFilterSql = ` AND source_management_mode = $${values.length} `;
    }

    switch (query.metric) {
      case 'schools_created':
        sourceSql = `
          SELECT
            s.created_at AS source_created_at,
            s.id AS source_school_id,
            s.management_mode::text AS source_management_mode
          FROM schools s
          WHERE s.deleted_at IS NULL
        `;
        break;

      case 'students_created':
        sourceSql = `
          SELECT
            st.created_at AS source_created_at,
            st.school_id AS source_school_id,
            s.management_mode::text AS source_management_mode
          FROM students st
          JOIN schools s ON s.id = st.school_id
          WHERE st.deleted_at IS NULL
            AND s.deleted_at IS NULL
        `;
        break;

      case 'teachers_created':
        sourceSql = `
          SELECT
            smr.created_at AS source_created_at,
            sm.school_id AS source_school_id,
            s.management_mode::text AS source_management_mode
          FROM school_membership_roles smr
          JOIN school_memberships sm ON sm.id = smr.school_membership_id
          JOIN schools s ON s.id = sm.school_id
          WHERE smr.deleted_at IS NULL
            AND sm.deleted_at IS NULL
            AND s.deleted_at IS NULL
            AND smr.role = 'TEACHER'
        `;
        break;

      case 'finance_admins_created':
        sourceSql = `
          SELECT
            smr.created_at AS source_created_at,
            sm.school_id AS source_school_id,
            s.management_mode::text AS source_management_mode
          FROM school_membership_roles smr
          JOIN school_memberships sm ON sm.id = smr.school_membership_id
          JOIN schools s ON s.id = sm.school_id
          WHERE smr.deleted_at IS NULL
            AND sm.deleted_at IS NULL
            AND s.deleted_at IS NULL
            AND smr.role = 'FINANCE_ADMIN'
        `;
        break;
    }

    const result = await this.db.query<{
      label: string;
      value: string;
      bucket_start: string;
    }>(
      `
      WITH buckets AS (
        SELECT generate_series(
          date_trunc($3::text, $1::timestamptz),
          date_trunc($3::text, $2::timestamptz),
          $4::interval
        ) AS bucket_start
      ),
      source_data AS (
        ${sourceSql}
      ),
      filtered_data AS (
        SELECT *
        FROM source_data
        WHERE source_created_at >= $1
          AND source_created_at <= $2
          ${schoolFilterSql}
          ${modeFilterSql}
      ),
      grouped AS (
        SELECT
          date_trunc($3::text, source_created_at) AS bucket_start,
          COUNT(*)::text AS value
        FROM filtered_data
        GROUP BY 1
      )
      SELECT
        to_char(b.bucket_start, $5::text) AS label,
        COALESCE(g.value, '0') AS value,
        b.bucket_start::text AS bucket_start
      FROM buckets b
      LEFT JOIN grouped g
        ON g.bucket_start = b.bucket_start
      ORDER BY b.bucket_start ASC
      `,
      values,
    );

    return {
      metric: query.metric,
      range: query.range,
      schoolId: query.schoolId ?? null,
      managementMode: query.managementMode ?? null,
      series: result.rows.map((row) => ({
        label: row.label,
        value: Number(row.value),
        bucketStart: row.bucket_start,
      })),
    };
  }

  private getRangeConfig(range: '30d' | '90d' | '12m') {
    const now = new Date();

    if (range === '30d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);

      const end = new Date(now);
      end.setHours(23, 59, 59, 999);

      return {
        start: start.toISOString(),
        end: end.toISOString(),
        bucket: 'day',
        step: '1 day',
        labelFormat: 'Mon DD',
      };
    }

    if (range === '90d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 84);
      start.setHours(0, 0, 0, 0);

      const end = new Date(now);
      end.setHours(23, 59, 59, 999);

      return {
        start: start.toISOString(),
        end: end.toISOString(),
        bucket: 'week',
        step: '1 week',
        labelFormat: 'Mon DD',
      };
    }

    const start = new Date(now);
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      bucket: 'month',
      step: '1 month',
      labelFormat: 'Mon YY',
    };
  }
}