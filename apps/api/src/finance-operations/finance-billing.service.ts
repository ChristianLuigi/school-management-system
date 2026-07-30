import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { BillingRunQueryDto } from './dto/billing-run-query.dto';
import { BillingRunRequestDto } from './dto/billing-run-request.dto';
import { CreateBillingPlanDto } from './dto/create-billing-plan.dto';
import { UpdateBillingPlanStatusDto } from './dto/update-billing-plan-status.dto';
import { assertFinanceDateOpen } from './security/finance-period-policy';

type PlatformRole = 'SUPER_ADMIN' | null;

type BillingPlanRow = {
  id: string;
  school_id: string;
  plan_code: string;
  academic_year_id: string;
  academic_year_name: Record<string, string>;
  grade_level_id: string | null;
  grade_level_code: string | null;
  grade_level_name: Record<string, string> | null;
  name_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  fee_type: 'TUITION' | 'REGISTRATION' | 'TRANSPORT';
  billing_frequency: 'MONTHLY' | 'TRIMESTER' | 'ONE_TIME';
  default_amount: string;
  currency_code: string;
  default_due_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type EligibleStudentRow = {
  student_id: string;
  enrollment_id: string;
  student_code: string | null;
  first_name: string | null;
  last_name: string | null;
  grade_level_id: string;
  grade_level_code: string;
  section_id: string;
  section_code: string;
  existing_invoice_id: string | null;
  existing_invoice_number: string | null;
};

type QueryClient = Pick<PoolClient, 'query'>;

@Injectable()
export class FinanceBillingService {
  constructor(
    private readonly db: DbService,
    private readonly activity: PlatformActivityService,
  ) {}

  private actorType(platformRole: PlatformRole) {
    return platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF';
  }

  private normalizeI18n(
    value: Record<string, string>,
    fieldName: string,
    required: boolean,
  ) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new BadRequestException(`${fieldName} must be an object.`);
    }
    const result: Record<string, string> = {};
    for (const locale of ['fr', 'en']) {
      const text = value[locale];
      if (typeof text === 'string' && text.trim()) {
        result[locale] = text.trim().slice(0, 200);
      }
    }
    if (required && !result.fr && !result.en) {
      throw new BadRequestException(
        `${fieldName} must contain a French or English value.`,
      );
    }
    return result;
  }

  private normalizeIdempotencyKey(value: string | undefined) {
    const normalized = value?.trim();
    if (!normalized || normalized.length < 8 || normalized.length > 128) {
      throw new BadRequestException(
        'Idempotency-Key must contain between 8 and 128 characters.',
      );
    }
    return normalized;
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private dateOnly() {
    return new Date().toISOString().slice(0, 10);
  }

  private addDays(dateValue: string, days: number) {
    const date = new Date(`${dateValue}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private normalizePeriodCode(value: string) {
    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(normalized)) {
      throw new BadRequestException('Billing period code is invalid.');
    }
    return normalized;
  }

  private planLabel(plan: BillingPlanRow) {
    return plan.name_i18n.fr || plan.name_i18n.en || plan.plan_code;
  }

  private mapPlan(row: BillingPlanRow) {
    return {
      id: row.id,
      schoolId: row.school_id,
      planCode: row.plan_code,
      academicYearId: row.academic_year_id,
      academicYearName: row.academic_year_name,
      gradeLevelId: row.grade_level_id,
      gradeLevelCode: row.grade_level_code,
      gradeLevelName: row.grade_level_name,
      nameI18n: row.name_i18n,
      descriptionI18n: row.description_i18n,
      feeType: row.fee_type,
      billingFrequency: row.billing_frequency,
      defaultAmount: Number(row.default_amount),
      currencyCode: row.currency_code,
      defaultDueDays: Number(row.default_due_days),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async loadPlan(
    client: QueryClient,
    schoolId: string,
    planId: string,
    lock = false,
  ) {
    const result = await client.query<BillingPlanRow>(
      `
      SELECT
        plan.id,
        plan.school_id,
        plan.plan_code,
        plan.academic_year_id,
        year.name_i18n AS academic_year_name,
        plan.grade_level_id,
        grade.code AS grade_level_code,
        grade.name_i18n AS grade_level_name,
        plan.name_i18n,
        plan.description_i18n,
        plan.fee_type::text AS fee_type,
        plan.billing_frequency::text AS billing_frequency,
        plan.default_amount::text AS default_amount,
        plan.currency_code,
        plan.default_due_days,
        plan.is_active,
        plan.created_at::text AS created_at,
        plan.updated_at::text AS updated_at
      FROM fee_plans plan
      JOIN academic_years year
        ON year.id = plan.academic_year_id
       AND year.school_id = plan.school_id
       AND year.deleted_at IS NULL
      LEFT JOIN grade_levels grade
        ON grade.id = plan.grade_level_id
       AND grade.school_id = plan.school_id
       AND grade.deleted_at IS NULL
      WHERE plan.id = $1
        AND plan.school_id = $2
        AND plan.plan_code IS NOT NULL
        AND plan.academic_year_id IS NOT NULL
        AND plan.deleted_at IS NULL
      LIMIT 1
      ${lock ? 'FOR UPDATE OF plan' : ''}
      `,
      [planId, schoolId],
    );
    const plan = result.rows[0];
    if (!plan) {
      throw new NotFoundException('Billing plan not found for this school.');
    }
    return plan;
  }

  async getContext(schoolId: string) {
    const [years, grades, plans, runs] = await Promise.all([
      this.db.query<{
        id: string;
        name_i18n: Record<string, string>;
        status: string;
        start_date: string;
        end_date: string;
      }>(
        `
        SELECT
          id,
          name_i18n,
          status::text AS status,
          start_date::text AS start_date,
          end_date::text AS end_date
        FROM academic_years
        WHERE school_id = $1
          AND deleted_at IS NULL
        ORDER BY start_date DESC
        `,
        [schoolId],
      ),
      this.db.query<{
        id: string;
        code: string;
        name_i18n: Record<string, string>;
      }>(
        `
        SELECT id, code, name_i18n
        FROM grade_levels
        WHERE school_id = $1
          AND deleted_at IS NULL
        ORDER BY display_order, code
        `,
        [schoolId],
      ),
      this.db.query<BillingPlanRow>(
        `
        SELECT
          plan.id,
          plan.school_id,
          plan.plan_code,
          plan.academic_year_id,
          year.name_i18n AS academic_year_name,
          plan.grade_level_id,
          grade.code AS grade_level_code,
          grade.name_i18n AS grade_level_name,
          plan.name_i18n,
          plan.description_i18n,
          plan.fee_type::text AS fee_type,
          plan.billing_frequency::text AS billing_frequency,
          plan.default_amount::text AS default_amount,
          plan.currency_code,
          plan.default_due_days,
          plan.is_active,
          plan.created_at::text AS created_at,
          plan.updated_at::text AS updated_at
        FROM fee_plans plan
        JOIN academic_years year
          ON year.id = plan.academic_year_id
         AND year.school_id = plan.school_id
         AND year.deleted_at IS NULL
        LEFT JOIN grade_levels grade
          ON grade.id = plan.grade_level_id
         AND grade.school_id = plan.school_id
         AND grade.deleted_at IS NULL
        WHERE plan.school_id = $1
          AND plan.plan_code IS NOT NULL
          AND plan.academic_year_id IS NOT NULL
          AND plan.deleted_at IS NULL
        ORDER BY plan.is_active DESC, year.start_date DESC, plan.plan_code
        `,
        [schoolId],
      ),
      this.listRuns({ schoolId, limit: 10 }),
    ]);
    return {
      schoolId,
      academicYears: years.rows.map((row) => ({
        id: row.id,
        nameI18n: row.name_i18n,
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
      })),
      gradeLevels: grades.rows.map((row) => ({
        id: row.id,
        code: row.code,
        nameI18n: row.name_i18n,
      })),
      plans: plans.rows.map((row) => this.mapPlan(row)),
      recentRuns: runs,
    };
  }

  async createPlan(
    dto: CreateBillingPlanDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const nameI18n = this.normalizeI18n(dto.nameI18n, 'Plan name', true);
    const descriptionI18n = this.normalizeI18n(
      dto.descriptionI18n ?? {},
      'Plan description',
      false,
    );
    const planCode = dto.planCode.trim().toUpperCase();
    const currencyCode = dto.currencyCode.trim().toUpperCase();
    const amount = Number(dto.defaultAmount.toFixed(2));
    if (amount <= 0) {
      throw new BadRequestException('Billing plan amount must be positive.');
    }

    try {
      return await this.db.withTransaction(async (client) => {
        const scope = await client.query<{
          academic_year_id: string;
          grade_level_id: string | null;
        }>(
          `
          SELECT
            year.id AS academic_year_id,
            grade.id AS grade_level_id
          FROM academic_years year
          LEFT JOIN grade_levels grade
            ON grade.id = $3::uuid
           AND grade.school_id = year.school_id
           AND grade.deleted_at IS NULL
          WHERE year.id = $1
            AND year.school_id = $2
            AND year.deleted_at IS NULL
          LIMIT 1
          `,
          [dto.academicYearId, dto.schoolId, dto.gradeLevelId ?? null],
        );
        if (!scope.rows[0]) {
          throw new BadRequestException(
            'Academic year not found for this school.',
          );
        }
        if (dto.gradeLevelId && !scope.rows[0].grade_level_id) {
          throw new BadRequestException(
            'Grade level not found for this school.',
          );
        }

        const result = await client.query<{ id: string }>(
          `
          INSERT INTO fee_plans (
            school_id,
            plan_code,
            academic_year_id,
            grade_level_id,
            name_i18n,
            description_i18n,
            fee_type,
            billing_frequency,
            default_amount,
            currency_code,
            default_due_days,
            is_active,
            created_by_user_id
          )
          VALUES (
            $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::fee_type,
            $8::billing_frequency, $9, $10, $11, TRUE, $12
          )
          RETURNING id
          `,
          [
            dto.schoolId,
            planCode,
            dto.academicYearId,
            dto.gradeLevelId ?? null,
            JSON.stringify(nameI18n),
            JSON.stringify(descriptionI18n),
            dto.feeType,
            dto.billingFrequency,
            amount,
            currencyCode,
            dto.defaultDueDays ?? 30,
            actorUserId,
          ],
        );
        const plan = await this.loadPlan(
          client,
          dto.schoolId,
          result.rows[0].id,
        );
        await this.activity.recordTx(client, {
          eventType: 'FINANCE_BILLING_PLAN_CREATED',
          actorType: this.actorType(platformRole),
          actorUserId,
          schoolId: dto.schoolId,
          summary: `Billing plan ${planCode} created.`,
          payload: {
            planId: plan.id,
            planCode,
            academicYearId: dto.academicYearId,
            gradeLevelId: dto.gradeLevelId ?? null,
            feeType: dto.feeType,
            billingFrequency: dto.billingFrequency,
            amount,
            currencyCode,
            operatorNote: dto.operatorNote?.trim() || null,
          },
        });
        return this.mapPlan(plan);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'A billing plan with this code already exists for the academic year.',
        );
      }
      throw error;
    }
  }

  async updatePlanStatus(
    planId: string,
    dto: UpdateBillingPlanStatusDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    return this.db.withTransaction(async (client) => {
      const plan = await this.loadPlan(client, dto.schoolId, planId, true);
      if (plan.is_active === dto.isActive) {
        return this.mapPlan(plan);
      }
      await client.query(
        `
        UPDATE fee_plans
        SET
          is_active = $3,
          archived_at = CASE WHEN $3 THEN NULL ELSE NOW() END,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [planId, dto.schoolId, dto.isActive],
      );
      const updated = await this.loadPlan(client, dto.schoolId, planId);
      await this.activity.recordTx(client, {
        eventType: 'FINANCE_BILLING_PLAN_STATUS_CHANGED',
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Billing plan ${plan.plan_code} ${dto.isActive ? 'reactivated' : 'archived'}.`,
        payload: {
          planId,
          planCode: plan.plan_code,
          previousStatus: plan.is_active ? 'ACTIVE' : 'ARCHIVED',
          newStatus: dto.isActive ? 'ACTIVE' : 'ARCHIVED',
        },
      });
      return this.mapPlan(updated);
    });
  }

  private async eligibleStudents(
    client: QueryClient,
    plan: BillingPlanRow,
    periodCode: string,
    studentIds: string[],
  ) {
    const selected = studentIds.length > 0;
    const result = await client.query<EligibleStudentRow>(
      `
      SELECT
        student.id AS student_id,
        enrollment.id AS enrollment_id,
        COALESCE(student.student_code, student.student_number) AS student_code,
        student.first_name,
        student.last_name,
        enrollment.grade_level_id,
        grade.code AS grade_level_code,
        enrollment.section_id,
        section.code AS section_code,
        prior.invoice_id AS existing_invoice_id,
        invoice.invoice_number AS existing_invoice_number
      FROM enrollments enrollment
      JOIN students student
        ON student.id = enrollment.student_id
       AND student.school_id = $1
       AND student.status = 'ACTIVE'
       AND student.deleted_at IS NULL
      JOIN grade_levels grade
        ON grade.id = enrollment.grade_level_id
       AND grade.school_id = $1
       AND grade.deleted_at IS NULL
      JOIN sections section
        ON section.id = enrollment.section_id
       AND section.school_id = $1
       AND section.academic_year_id = enrollment.academic_year_id
       AND section.deleted_at IS NULL
      LEFT JOIN finance_billing_run_items prior
        ON prior.school_id = $1
       AND prior.student_id = student.id
       AND prior.fee_plan_id = $2
       AND prior.academic_year_id = $3
       AND prior.billing_period_code = $4
       AND prior.item_status = 'GENERATED'
      LEFT JOIN invoices invoice
        ON invoice.id = prior.invoice_id
       AND invoice.school_id = $1
       AND invoice.deleted_at IS NULL
      WHERE enrollment.academic_year_id = $3
        AND enrollment.enrollment_status = 'ACTIVE'
        AND enrollment.deleted_at IS NULL
        AND ($5::uuid IS NULL OR enrollment.grade_level_id = $5)
        AND (
          cardinality($6::uuid[]) = 0
          OR student.id = ANY($6::uuid[])
        )
      ORDER BY student.last_name, student.first_name, student.id
      LIMIT 501
      `,
      [
        plan.school_id,
        plan.id,
        plan.academic_year_id,
        periodCode,
        plan.grade_level_id,
        studentIds,
      ],
    );
    if (!selected && result.rows.length > 500) {
      throw new BadRequestException(
        'This billing run exceeds 500 students. Use a grade-specific plan.',
      );
    }
    if (selected && result.rows.length !== studentIds.length) {
      throw new BadRequestException(
        'One or more selected students are not actively enrolled in this billing plan scope.',
      );
    }
    return result.rows;
  }

  private normalizeRunInput(dto: BillingRunRequestDto, plan: BillingPlanRow) {
    const billingPeriodCode = this.normalizePeriodCode(dto.billingPeriodCode);
    const issueDate = dto.issueDate ?? this.dateOnly();
    const dueDate =
      dto.dueDate ?? this.addDays(issueDate, Number(plan.default_due_days));
    if (dueDate < issueDate) {
      throw new BadRequestException('Due date cannot be before issue date.');
    }
    return {
      billingPeriodCode,
      issueDate,
      dueDate,
      invoiceStatus: dto.invoiceStatus ?? ('ISSUED' as const),
      studentIds: [...new Set(dto.studentIds ?? [])].sort(),
    };
  }

  async preview(dto: BillingRunRequestDto) {
    const plan = await this.loadPlan(this.db, dto.schoolId, dto.feePlanId);
    if (!plan.is_active) {
      throw new BadRequestException('The selected billing plan is archived.');
    }
    const input = this.normalizeRunInput(dto, plan);
    const students = await this.eligibleStudents(
      this.db,
      plan,
      input.billingPeriodCode,
      input.studentIds,
    );
    if (!students.length) {
      throw new BadRequestException(
        'No actively enrolled students match this billing plan.',
      );
    }
    const alreadyBilled = students.filter(
      (student) => student.existing_invoice_id,
    ).length;
    return {
      plan: this.mapPlan(plan),
      billingPeriodCode: input.billingPeriodCode,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      invoiceStatus: input.invoiceStatus,
      summary: {
        candidateCount: students.length,
        generatedCount: students.length - alreadyBilled,
        skippedDuplicateCount: alreadyBilled,
        totalAmount: Number(
          (
            (students.length - alreadyBilled) *
            Number(plan.default_amount)
          ).toFixed(2),
        ),
        currencyCode: plan.currency_code,
      },
      students: students.map((student) => ({
        id: student.student_id,
        studentCode: student.student_code,
        firstName: student.first_name,
        lastName: student.last_name,
        gradeLevelId: student.grade_level_id,
        gradeLevelCode: student.grade_level_code,
        sectionId: student.section_id,
        sectionCode: student.section_code,
        alreadyBilled: Boolean(student.existing_invoice_id),
        existingInvoiceId: student.existing_invoice_id,
        existingInvoiceNumber: student.existing_invoice_number,
      })),
    };
  }

  async createRun(
    dto: BillingRunRequestDto,
    actorUserId: string,
    platformRole: PlatformRole,
    idempotencyKeyValue?: string,
  ) {
    const idempotencyKey = this.normalizeIdempotencyKey(idempotencyKeyValue);
    const normalizedStudentIds = [...new Set(dto.studentIds ?? [])].sort();
    const requestHash = this.hash({
      schoolId: dto.schoolId,
      feePlanId: dto.feePlanId,
      billingPeriodCode: this.normalizePeriodCode(dto.billingPeriodCode),
      issueDate: dto.issueDate ?? null,
      dueDate: dto.dueDate ?? null,
      invoiceStatus: dto.invoiceStatus ?? 'ISSUED',
      studentIds: normalizedStudentIds,
    });

    return this.db.withTransaction(async (client) => {
      await client.query(
        `
        SELECT pg_advisory_xact_lock(
          hashtextextended($1, 0)
        )
        `,
        [
          [
            'FINANCE_BILLING',
            dto.schoolId,
            dto.feePlanId,
            this.normalizePeriodCode(dto.billingPeriodCode),
          ].join(':'),
        ],
      );

      const replay = await client.query<{
        request_hash: string;
        response_body: Record<string, unknown>;
      }>(
        `
        SELECT request_hash, response_body
        FROM finance_billing_runs
        WHERE school_id = $1
          AND idempotency_key = $2
        LIMIT 1
        `,
        [dto.schoolId, idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].request_hash !== requestHash) {
          throw new ConflictException(
            'This idempotency key was already used for a different billing run.',
          );
        }
        return replay.rows[0].response_body;
      }

      const plan = await this.loadPlan(
        client,
        dto.schoolId,
        dto.feePlanId,
        true,
      );
      if (!plan.is_active) {
        throw new BadRequestException('The selected billing plan is archived.');
      }
      const input = this.normalizeRunInput(
        { ...dto, studentIds: normalizedStudentIds },
        plan,
      );
      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        input.issueDate,
        'Billing run creation',
      );
      const students = await this.eligibleStudents(
        client,
        plan,
        input.billingPeriodCode,
        input.studentIds,
      );
      if (!students.length) {
        throw new BadRequestException(
          'No actively enrolled students match this billing plan.',
        );
      }

      const generatedCount = students.filter(
        (student) => !student.existing_invoice_id,
      ).length;
      const skippedCount = students.length - generatedCount;
      const planSnapshot = {
        id: plan.id,
        planCode: plan.plan_code,
        nameI18n: plan.name_i18n,
        feeType: plan.fee_type,
        billingFrequency: plan.billing_frequency,
        academicYearId: plan.academic_year_id,
        gradeLevelId: plan.grade_level_id,
        unitAmount: Number(plan.default_amount),
        currencyCode: plan.currency_code,
      };
      const runResult = await client.query<{ id: string; created_at: string }>(
        `
        INSERT INTO finance_billing_runs (
          school_id,
          fee_plan_id,
          academic_year_id,
          grade_level_id,
          billing_period_code,
          issue_date,
          due_date,
          invoice_status,
          currency_code,
          unit_amount,
          candidate_count,
          generated_count,
          skipped_count,
          plan_snapshot,
          idempotency_key,
          request_hash,
          created_by_user_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10,
          $11, $12, $13, $14::jsonb, $15, $16, $17
        )
        RETURNING id, created_at::text AS created_at
        `,
        [
          dto.schoolId,
          plan.id,
          plan.academic_year_id,
          plan.grade_level_id,
          input.billingPeriodCode,
          input.issueDate,
          input.dueDate,
          input.invoiceStatus,
          plan.currency_code,
          Number(plan.default_amount),
          students.length,
          generatedCount,
          skippedCount,
          JSON.stringify(planSnapshot),
          idempotencyKey,
          requestHash,
          actorUserId,
        ],
      );
      const run = runResult.rows[0];
      const gradingPeriod = await client.query<{ id: string }>(
        `
        SELECT id
        FROM grading_periods
        WHERE academic_year_id = $1
          AND deleted_at IS NULL
          AND (
            $2::date BETWEEN start_date AND end_date
            OR is_current = TRUE
          )
        ORDER BY
          CASE WHEN $2::date BETWEEN start_date AND end_date THEN 0 ELSE 1 END,
          is_current DESC,
          start_date
        LIMIT 1
        `,
        [plan.academic_year_id, input.issueDate],
      );

      const generatedInvoices: Array<{
        id: string;
        invoiceNumber: string;
        studentId: string;
      }> = [];
      const skippedStudents: Array<{
        studentId: string;
        existingInvoiceId: string;
        existingInvoiceNumber: string | null;
      }> = [];
      const title = this.planLabel(plan);
      const unitAmount = Number(plan.default_amount);

      for (const student of students) {
        if (student.existing_invoice_id) {
          await client.query(
            `
            INSERT INTO finance_billing_run_items (
              school_id,
              billing_run_id,
              fee_plan_id,
              academic_year_id,
              grade_level_id,
              enrollment_id,
              student_id,
              billing_period_code,
              item_status,
              existing_invoice_id,
              skip_reason
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8,
              'SKIPPED_DUPLICATE', $9, 'ALREADY_BILLED'
            )
            `,
            [
              dto.schoolId,
              run.id,
              plan.id,
              plan.academic_year_id,
              student.grade_level_id,
              student.enrollment_id,
              student.student_id,
              input.billingPeriodCode,
              student.existing_invoice_id,
            ],
          );
          skippedStudents.push({
            studentId: student.student_id,
            existingInvoiceId: student.existing_invoice_id,
            existingInvoiceNumber: student.existing_invoice_number,
          });
          continue;
        }

        const invoiceNumber = await client.query<{ invoice_number: string }>(
          'SELECT next_invoice_number($1) AS invoice_number',
          [dto.schoolId],
        );
        const invoice = await client.query<{
          id: string;
          invoice_number: string;
        }>(
          `
          INSERT INTO invoices (
            school_id,
            student_id,
            academic_year_id,
            grading_period_id,
            fee_plan_id,
            billing_run_id,
            invoice_number,
            invoice_title,
            invoice_status,
            issue_date,
            due_date,
            subtotal_amount,
            discount_amount,
            total_amount,
            amount_paid,
            balance_due,
            currency_code,
            notes,
            created_by_user_id
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::invoice_status,
            $10::date, $11::date, $12, 0, $12, 0, $12, $13, $14, $15
          )
          RETURNING id, invoice_number
          `,
          [
            dto.schoolId,
            student.student_id,
            plan.academic_year_id,
            gradingPeriod.rows[0]?.id ?? null,
            plan.id,
            run.id,
            invoiceNumber.rows[0].invoice_number,
            title,
            input.invoiceStatus,
            input.issueDate,
            input.dueDate,
            unitAmount,
            plan.currency_code,
            `Billing plan ${plan.plan_code}; period ${input.billingPeriodCode}.`,
            actorUserId,
          ],
        );
        await client.query(
          `
          INSERT INTO invoice_items (
            school_id,
            invoice_id,
            fee_plan_id,
            billing_run_id,
            description,
            quantity,
            unit_amount,
            line_total
          )
          VALUES ($1, $2, $3, $4, $5, 1, $6, $6)
          `,
          [
            dto.schoolId,
            invoice.rows[0].id,
            plan.id,
            run.id,
            title,
            unitAmount,
          ],
        );
        await client.query(
          `
          INSERT INTO finance_billing_run_items (
            school_id,
            billing_run_id,
            fee_plan_id,
            academic_year_id,
            grade_level_id,
            enrollment_id,
            student_id,
            billing_period_code,
            item_status,
            invoice_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'GENERATED', $9)
          `,
          [
            dto.schoolId,
            run.id,
            plan.id,
            plan.academic_year_id,
            student.grade_level_id,
            student.enrollment_id,
            student.student_id,
            input.billingPeriodCode,
            invoice.rows[0].id,
          ],
        );
        generatedInvoices.push({
          id: invoice.rows[0].id,
          invoiceNumber: invoice.rows[0].invoice_number,
          studentId: student.student_id,
        });
      }

      const response = {
        id: run.id,
        schoolId: dto.schoolId,
        feePlanId: plan.id,
        planCode: plan.plan_code,
        billingPeriodCode: input.billingPeriodCode,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        invoiceStatus: input.invoiceStatus,
        currencyCode: plan.currency_code,
        unitAmount,
        candidateCount: students.length,
        generatedCount: generatedInvoices.length,
        skippedDuplicateCount: skippedStudents.length,
        totalGeneratedAmount: Number(
          (generatedInvoices.length * unitAmount).toFixed(2),
        ),
        generatedInvoices,
        skippedStudents,
        createdAt: run.created_at,
      };
      await client.query(
        `
        UPDATE finance_billing_runs
        SET response_body = $2::jsonb
        WHERE id = $1
        `,
        [run.id, JSON.stringify(response)],
      );
      await this.activity.recordTx(client, {
        eventType: 'FINANCE_BILLING_RUN_COMPLETED',
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Billing run ${plan.plan_code}/${input.billingPeriodCode} generated ${generatedInvoices.length} invoice(s).`,
        payload: {
          billingRunId: run.id,
          feePlanId: plan.id,
          planCode: plan.plan_code,
          academicYearId: plan.academic_year_id,
          gradeLevelId: plan.grade_level_id,
          billingPeriodCode: input.billingPeriodCode,
          candidateCount: students.length,
          generatedCount: generatedInvoices.length,
          skippedDuplicateCount: skippedStudents.length,
          unitAmount,
          totalGeneratedAmount: response.totalGeneratedAmount,
          currencyCode: plan.currency_code,
        },
      });
      return response;
    });
  }

  async listRuns(query: BillingRunQueryDto) {
    const result = await this.db.query<{
      id: string;
      fee_plan_id: string;
      plan_code: string;
      plan_name: Record<string, string>;
      billing_period_code: string;
      issue_date: string;
      due_date: string;
      invoice_status: string;
      currency_code: string;
      unit_amount: string;
      candidate_count: number;
      generated_count: number;
      skipped_count: number;
      created_at: string;
      created_by_email: string;
    }>(
      `
      SELECT
        run.id,
        run.fee_plan_id,
        plan.plan_code,
        plan.name_i18n AS plan_name,
        run.billing_period_code,
        run.issue_date::text AS issue_date,
        run.due_date::text AS due_date,
        run.invoice_status,
        run.currency_code,
        run.unit_amount::text AS unit_amount,
        run.candidate_count,
        run.generated_count,
        run.skipped_count,
        run.created_at::text AS created_at,
        actor.email_original AS created_by_email
      FROM finance_billing_runs run
      JOIN fee_plans plan
        ON plan.id = run.fee_plan_id
       AND plan.school_id = run.school_id
      JOIN users actor
        ON actor.id = run.created_by_user_id
      WHERE run.school_id = $1
      ORDER BY run.created_at DESC
      LIMIT $2
      `,
      [query.schoolId, query.limit ?? 25],
    );
    return result.rows.map((row) => ({
      id: row.id,
      feePlanId: row.fee_plan_id,
      planCode: row.plan_code,
      planName: row.plan_name,
      billingPeriodCode: row.billing_period_code,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      invoiceStatus: row.invoice_status,
      currencyCode: row.currency_code,
      unitAmount: Number(row.unit_amount),
      candidateCount: row.candidate_count,
      generatedCount: row.generated_count,
      skippedDuplicateCount: row.skipped_count,
      totalGeneratedAmount: Number(
        (row.generated_count * Number(row.unit_amount)).toFixed(2),
      ),
      createdAt: row.created_at,
      createdByEmail: row.created_by_email,
    }));
  }

  async getRun(schoolId: string, runId: string) {
    const run = await this.db.query<{
      response_body: Record<string, unknown>;
      plan_snapshot: Record<string, unknown>;
    }>(
      `
      SELECT response_body, plan_snapshot
      FROM finance_billing_runs
      WHERE id = $1
        AND school_id = $2
      LIMIT 1
      `,
      [runId, schoolId],
    );
    if (!run.rows[0]) {
      throw new NotFoundException('Billing run not found for this school.');
    }
    const items = await this.db.query<{
      student_id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
      item_status: string;
      invoice_id: string | null;
      existing_invoice_id: string | null;
      invoice_number: string | null;
      skip_reason: string | null;
    }>(
      `
      SELECT
        item.student_id,
        COALESCE(student.student_code, student.student_number) AS student_code,
        student.first_name,
        student.last_name,
        item.item_status,
        item.invoice_id,
        item.existing_invoice_id,
        COALESCE(invoice.invoice_number, existing.invoice_number) AS invoice_number,
        item.skip_reason
      FROM finance_billing_run_items item
      JOIN students student
        ON student.id = item.student_id
       AND student.school_id = item.school_id
      LEFT JOIN invoices invoice ON invoice.id = item.invoice_id
      LEFT JOIN invoices existing ON existing.id = item.existing_invoice_id
      WHERE item.billing_run_id = $1
        AND item.school_id = $2
      ORDER BY student.last_name, student.first_name, student.id
      `,
      [runId, schoolId],
    );
    return {
      ...run.rows[0].response_body,
      planSnapshot: run.rows[0].plan_snapshot,
      items: items.rows.map((row) => ({
        studentId: row.student_id,
        studentCode: row.student_code,
        firstName: row.first_name,
        lastName: row.last_name,
        status: row.item_status,
        invoiceId: row.invoice_id ?? row.existing_invoice_id,
        invoiceNumber: row.invoice_number,
        skipReason: row.skip_reason,
      })),
    };
  }
}
