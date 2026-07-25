import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DbService) {}

  async getSchoolOverview(schoolId: string) {
    const result = await this.db.query<{
      overview_date: string;
      currency_code: string;
      active_students: string;
      registered_students: string;
      pending_admissions: string;
      admitted_applications: string;
      attendance_sessions_today: string;
      attendance_present_today: string;
      attendance_absent_today: string;
      unpaid_invoices: string;
      total_balance_due: string;
      payments_today: string;
      payments_month: string;
      payroll_pending_items: string;
    }>(
      `
      WITH school_context AS (
        SELECT
          id,
          timezone,
          currency_code,
          (CURRENT_TIMESTAMP AT TIME ZONE timezone)::date AS local_date
        FROM schools
        WHERE id = $1
          AND deleted_at IS NULL
      )
      SELECT
        sc.local_date::text AS overview_date,
        sc.currency_code,
        (SELECT COUNT(*)::text FROM students WHERE school_id = sc.id AND deleted_at IS NULL AND status = 'ACTIVE') AS active_students,
        (SELECT COUNT(*)::text FROM students WHERE school_id = sc.id AND deleted_at IS NULL AND status = 'REGISTERED') AS registered_students,
        (
          SELECT COUNT(*)::text
          FROM admission_applications
          WHERE school_id = sc.id
            AND deleted_at IS NULL
            AND admission_status IN (
              'PROSPECT', 'APPLICATION_SUBMITTED', 'DOCUMENTS_INCOMPLETE',
              'PENDING_PAYMENT', 'PENDING_EXAM', 'EXAM_SCHEDULED', 'WAITLISTED'
            )
        ) AS pending_admissions,
        (
          SELECT COUNT(*)::text
          FROM admission_applications
          WHERE school_id = sc.id
            AND deleted_at IS NULL
            AND admission_status IN ('ADMITTED', 'CONDITIONALLY_ADMITTED', 'CONFIRMED')
        ) AS admitted_applications,
        (
          SELECT COUNT(*)::text
          FROM attendance_sessions
          WHERE school_id = sc.id
            AND deleted_at IS NULL
            AND attendance_date = sc.local_date
        ) AS attendance_sessions_today,
        (
          SELECT COUNT(*)::text
          FROM attendance_records rec
          JOIN attendance_sessions sess
            ON sess.id = rec.attendance_session_id
           AND sess.deleted_at IS NULL
          WHERE sess.school_id = sc.id
            AND rec.deleted_at IS NULL
            AND sess.attendance_date = sc.local_date
            AND rec.status = 'PRESENT'
        ) AS attendance_present_today,
        (
          SELECT COUNT(*)::text
          FROM attendance_records rec
          JOIN attendance_sessions sess
            ON sess.id = rec.attendance_session_id
           AND sess.deleted_at IS NULL
          WHERE sess.school_id = sc.id
            AND rec.deleted_at IS NULL
            AND sess.attendance_date = sc.local_date
            AND rec.status = 'ABSENT'
        ) AS attendance_absent_today,
        (
          SELECT COUNT(*)::text
          FROM invoices
          WHERE school_id = sc.id
            AND deleted_at IS NULL
            AND invoice_status <> 'VOID'
            AND balance_due > 0
        ) AS unpaid_invoices,
        (
          SELECT COALESCE(SUM(balance_due), 0)::text
          FROM invoices
          WHERE school_id = sc.id
            AND deleted_at IS NULL
            AND invoice_status <> 'VOID'
            AND balance_due > 0
        ) AS total_balance_due,
        (
          SELECT COALESCE(SUM(amount), 0)::text
          FROM payments
          WHERE school_id = sc.id
            AND deleted_at IS NULL
            AND payment_status::text NOT IN ('CANCELLED', 'REFUNDED', 'REVERSED')
            AND (COALESCE(paid_at, payment_date::timestamptz, created_at) AT TIME ZONE sc.timezone)::date = sc.local_date
        ) AS payments_today,
        (
          SELECT COALESCE(SUM(amount), 0)::text
          FROM payments
          WHERE school_id = sc.id
            AND deleted_at IS NULL
            AND payment_status::text NOT IN ('CANCELLED', 'REFUNDED', 'REVERSED')
            AND date_trunc('month', COALESCE(paid_at, payment_date::timestamptz, created_at) AT TIME ZONE sc.timezone)
              = date_trunc('month', sc.local_date::timestamp)
        ) AS payments_month,
        (
          SELECT COUNT(*)::text
          FROM payroll_run_items
          WHERE school_id = sc.id
            AND deleted_at IS NULL
            AND payment_status = 'PENDING'
        ) AS payroll_pending_items
      FROM school_context sc
      `,
      [schoolId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException(`School ${schoolId} not found.`);
    }

    const assessmentsCount = await this.getAssessmentsCount(schoolId);

    return {
      date: row.overview_date,
      currencyCode: row.currency_code,
      students: {
        active: Number(row.active_students ?? 0),
        registered: Number(row.registered_students ?? 0),
      },
      admissions: {
        pending: Number(row.pending_admissions ?? 0),
        admitted: Number(row.admitted_applications ?? 0),
      },
      attendance: {
        sessionsToday: Number(row.attendance_sessions_today ?? 0),
        presentToday: Number(row.attendance_present_today ?? 0),
        absentToday: Number(row.attendance_absent_today ?? 0),
      },
      finance: {
        unpaidInvoices: Number(row.unpaid_invoices ?? 0),
        totalBalanceDue: Number(row.total_balance_due ?? 0),
        paymentsToday: Number(row.payments_today ?? 0),
        paymentsMonth: Number(row.payments_month ?? 0),
      },
      gradebooks: {
        assessmentsCount,
      },
      payroll: {
        pendingItems: Number(row.payroll_pending_items ?? 0),
      },
    };
  }
  private async getAssessmentsCount(schoolId: string) {
    const tableResult = await this.db.query<{ has_mvp_table: boolean }>(
      `
      SELECT to_regclass('public.gradebook_assessments') IS NOT NULL AS has_mvp_table
      `,
    );

    if (tableResult.rows[0]?.has_mvp_table) {
      const result = await this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM gradebook_assessments
        WHERE school_id = $1
          AND deleted_at IS NULL
        `,
        [schoolId],
      );

      return Number(result.rows[0]?.count ?? 0);
    }

    const result = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(ass.id)::text AS count
      FROM assessments ass
      JOIN gradebooks gb
        ON gb.id = ass.gradebook_id
       AND gb.deleted_at IS NULL
      JOIN section_subjects ss
        ON ss.id = gb.section_subject_id
       AND ss.deleted_at IS NULL
      WHERE ss.school_id = $1
        AND ass.deleted_at IS NULL
      `,
      [schoolId],
    );

    return Number(result.rows[0]?.count ?? 0);
  }
  async getSummary(schoolId: string, gradingPeriodId: string) {
    const gradingPeriodResult = await this.db.query<{
      id: string;
      academic_year_id: string;
      name_i18n: Record<string, string>;
    }>(
      `
      SELECT id, academic_year_id, name_i18n
      FROM grading_periods
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [gradingPeriodId],
    );

    const gradingPeriod = gradingPeriodResult.rows[0];

    if (!gradingPeriod) {
      throw new NotFoundException(
        `Grading period ${gradingPeriodId} not found.`,
      );
    }

    const [
      studentsResult,
      teachersResult,
      invoicesResult,
      overdueResult,
      gradebookCoverageResult,
    ] = await Promise.all([
      this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM students
        WHERE school_id = $1
          AND deleted_at IS NULL
          AND status = 'ACTIVE'
        `,
        [schoolId],
      ),

      this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM teachers
        WHERE school_id = $1
          AND deleted_at IS NULL
          AND is_active = TRUE
        `,
        [schoolId],
      ),

      this.db.query<{
        invoice_count: string;
        total_outstanding: string;
      }>(
        `
        SELECT
          COUNT(*)::text AS invoice_count,
          COALESCE(SUM(balance_due), 0)::text AS total_outstanding
        FROM invoices
        WHERE school_id = $1
          AND deleted_at IS NULL
          AND status <> 'VOID'
        `,
        [schoolId],
      ),

      this.db.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM invoices
        WHERE school_id = $1
          AND deleted_at IS NULL
          AND status = 'OVERDUE'
        `,
        [schoolId],
      ),

      this.db.query<{
        total_section_subjects: string;
        approved_gradebooks: string;
      }>(
        `
        SELECT
          COUNT(ss.id)::text AS total_section_subjects,
          COUNT(gb.id) FILTER (WHERE gb.status = 'APPROVED')::text AS approved_gradebooks
        FROM section_subjects ss
        LEFT JOIN gradebooks gb
          ON gb.section_subject_id = ss.id
         AND gb.grading_period_id = $2
         AND gb.deleted_at IS NULL
        WHERE ss.school_id = $1
          AND ss.academic_year_id = $3
          AND ss.is_active = TRUE
          AND ss.deleted_at IS NULL
        `,
        [schoolId, gradingPeriodId, gradingPeriod.academic_year_id],
      ),
    ]);

    const totalStudents = Number(studentsResult.rows[0]?.count ?? 0);
    const activeTeachers = Number(teachersResult.rows[0]?.count ?? 0);
    const totalInvoices = Number(invoicesResult.rows[0]?.invoice_count ?? 0);
    const totalOutstanding = Number(
      invoicesResult.rows[0]?.total_outstanding ?? 0,
    );
    const overdueInvoices = Number(overdueResult.rows[0]?.count ?? 0);

    const totalSectionSubjects = Number(
      gradebookCoverageResult.rows[0]?.total_section_subjects ?? 0,
    );
    const approvedGradebooks = Number(
      gradebookCoverageResult.rows[0]?.approved_gradebooks ?? 0,
    );

    const coveragePercent =
      totalSectionSubjects > 0
        ? Number(((approvedGradebooks / totalSectionSubjects) * 100).toFixed(1))
        : 0;

    return {
      schoolId,
      gradingPeriodId,
      gradingPeriodNameI18n: gradingPeriod.name_i18n,
      metrics: {
        totalStudents,
        activeTeachers,
        totalInvoices,
        totalOutstanding,
        overdueInvoices,
      },
      gradebookCoverage: {
        totalSectionSubjects,
        approvedGradebooks,
        coveragePercent,
        isComplete:
          totalSectionSubjects > 0 &&
          approvedGradebooks === totalSectionSubjects,
      },
    };
  }
}
