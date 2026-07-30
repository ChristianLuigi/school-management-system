import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PlatformActivityService } from '../platform-activity/platform-activity.service';
import { CashierWorkflowService } from './cashier-workflow.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CreateStudentInvoiceDto } from './dto/create-student-invoice.dto';
import { RecordStudentPaymentDto } from './dto/record-student-payment.dto';
import { UpdateFinanceSettingsDto } from './dto/update-finance-settings.dto';
import { assertFinanceDateOpen } from './security/finance-period-policy';

@Injectable()
export class FinanceOperationsService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
    private readonly cashierWorkflowService: CashierWorkflowService,
  ) {}

  private effectivePaymentStatusSql(paymentAlias: string) {
    if (!/^[a-z][a-z0-9_]*$/i.test(paymentAlias)) {
      throw new Error('Invalid internal payment alias.');
    }
    return `
      COALESCE(
        (
          SELECT CASE
            WHEN correction.correction_status = 'COMPLETED'
              AND correction.correction_type = 'REVERSAL'
              THEN 'REVERSED'
            WHEN correction.correction_status = 'COMPLETED'
              AND correction.correction_type = 'REFUND'
              THEN 'REFUNDED'
            WHEN correction.correction_status = 'APPROVED'
              THEN 'CORRECTION_APPROVED'
            WHEN correction.correction_status = 'PENDING_REVIEW'
              THEN 'CORRECTION_PENDING'
            ELSE NULL
          END
          FROM finance_payment_corrections correction
          WHERE correction.payment_id = ${paymentAlias}.id
            AND correction.correction_status <> 'REJECTED'
          ORDER BY correction.requested_at DESC
          LIMIT 1
        ),
        ${paymentAlias}.payment_status::text
      )
    `;
  }
  private addDays(dateString: string, days: number) {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private normalizeIdempotencyKey(value: string | undefined) {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 128) {
      throw new BadRequestException(
        'A valid Idempotency-Key header between 8 and 128 characters is required.',
      );
    }
    return key;
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));
      return `{${entries
        .map(
          ([key, entryValue]) =>
            `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`,
        )
        .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
  }

  private requestHash(value: unknown) {
    return createHash('sha256')
      .update(this.stableStringify(value))
      .digest('hex');
  }

  private async getIdempotentResponseTx<T>(
    client: PoolClient,
    input: {
      schoolId: string;
      operationType: string;
      idempotencyKey: string;
      requestHash: string;
      actorUserId: string;
    },
  ): Promise<T | null> {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [
        `finance:${input.schoolId}:${input.operationType}:${input.idempotencyKey}`,
      ],
    );

    const existing = await client.query<{
      request_hash: string;
      response_body: T;
      actor_user_id: string;
    }>(
      `
      SELECT request_hash, response_body, actor_user_id
      FROM finance_idempotency_records
      WHERE school_id = $1
        AND operation_type = $2
        AND idempotency_key = $3
      LIMIT 1
      `,
      [input.schoolId, input.operationType, input.idempotencyKey],
    );

    const record = existing.rows[0];
    if (!record) return null;
    if (
      record.request_hash !== input.requestHash ||
      record.actor_user_id !== input.actorUserId
    ) {
      throw new ConflictException(
        'The Idempotency-Key was already used for a different finance request.',
      );
    }
    return record.response_body;
  }

  private async saveIdempotentResponseTx(
    client: PoolClient,
    input: {
      schoolId: string;
      operationType: string;
      idempotencyKey: string;
      requestHash: string;
      responseBody: unknown;
      actorUserId: string;
    },
  ) {
    await client.query(
      `
      INSERT INTO finance_idempotency_records (
        school_id,
        operation_type,
        idempotency_key,
        request_hash,
        response_body,
        actor_user_id
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      `,
      [
        input.schoolId,
        input.operationType,
        input.idempotencyKey,
        input.requestHash,
        JSON.stringify(input.responseBody),
        input.actorUserId,
      ],
    );
  }

  private async assertPaymentMethodEnabledTx(
    client: PoolClient,
    schoolId: string,
    paymentMethod: string,
    reference: string | null,
  ) {
    const settings = await client.query<{
      enabled_payment_methods: string[];
    }>(
      `
      SELECT enabled_payment_methods
      FROM school_finance_settings
      WHERE school_id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );
    const enabledMethods = settings.rows[0]?.enabled_payment_methods ?? [
      'CASH',
      'BANK_TRANSFER',
      'CHECK',
      'MOBILE_MONEY',
      'CARD',
      'OTHER',
    ];
    if (!enabledMethods.includes(paymentMethod)) {
      throw new BadRequestException(
        'The selected payment method is not enabled for this school.',
      );
    }
    if (paymentMethod !== 'CASH' && !reference) {
      throw new BadRequestException(
        'A payment reference is required for non-cash payments.',
      );
    }
  }

  async getFinanceSettings(
    schoolId: string,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(actorUserId, schoolId, platformRole);

    await this.db.query(
      `
      INSERT INTO school_finance_settings (school_id)
      VALUES ($1)
      ON CONFLICT DO NOTHING
      `,
      [schoolId],
    );

    const result = await this.db.query<{
      id: string;
      school_id: string;
      default_currency_code: string;
      default_invoice_due_days: string;
      enabled_payment_methods: string[];
      finance_contact_name: string | null;
      finance_contact_email: string | null;
      finance_contact_phone: string | null;
      invoice_footer_i18n: Record<string, string>;
      receipt_footer_i18n: Record<string, string>;
      default_receipt_print_format: string;
      default_invoice_print_format: string;
      auto_open_receipt_after_payment: boolean;
      updated_at: string;
    }>(
      `
      SELECT
        id,
        school_id,
        default_currency_code,
        default_invoice_due_days::text AS default_invoice_due_days,
        enabled_payment_methods,
        finance_contact_name,
        finance_contact_email,
        finance_contact_phone,
        invoice_footer_i18n,
        receipt_footer_i18n,
        default_receipt_print_format,
        default_invoice_print_format,
        auto_open_receipt_after_payment,
        updated_at::text
      FROM school_finance_settings
      WHERE school_id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );

    const row = result.rows[0];

    return {
      id: row.id,
      schoolId: row.school_id,
      defaultCurrencyCode: row.default_currency_code,
      defaultInvoiceDueDays: Number(row.default_invoice_due_days),
      enabledPaymentMethods: row.enabled_payment_methods,
      financeContactName: row.finance_contact_name,
      financeContactEmail: row.finance_contact_email,
      financeContactPhone: row.finance_contact_phone,
      invoiceFooterI18n: row.invoice_footer_i18n,
      receiptFooterI18n: row.receipt_footer_i18n,
      defaultReceiptPrintFormat: row.default_receipt_print_format,
      defaultInvoicePrintFormat: row.default_invoice_print_format,
      autoOpenReceiptAfterPayment: row.auto_open_receipt_after_payment,
      updatedAt: row.updated_at,
    };
  }

  async updateFinanceSettings(
    dto: UpdateFinanceSettingsDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );

    const result = await this.db.query<{
      id: string;
    }>(
      `
      INSERT INTO school_finance_settings (
        school_id,
        default_currency_code,
        default_invoice_due_days,
        enabled_payment_methods,
        finance_contact_name,
        finance_contact_email,
        finance_contact_phone,
        invoice_footer_i18n,
        receipt_footer_i18n,
        default_receipt_print_format,
        default_invoice_print_format,
        auto_open_receipt_after_payment,
        updated_by_user_id
      )
      VALUES (
        $1,
        COALESCE($2, 'USD'),
        COALESCE($3, 30),
        COALESCE($4::jsonb, '["CASH","BANK_TRANSFER","CHECK","MOBILE_MONEY","CARD","OTHER"]'::jsonb),
        $5,
        $6,
        $7,
        COALESCE($8::jsonb, '{}'::jsonb),
        COALESCE($9::jsonb, '{}'::jsonb),
        COALESCE($10, 'THERMAL_80MM'),
        COALESCE($11, 'A4'),
        COALESCE($12, FALSE),
        $13
      )
      ON CONFLICT (school_id)
      WHERE deleted_at IS NULL
      DO UPDATE SET
        default_currency_code = EXCLUDED.default_currency_code,
        default_invoice_due_days = EXCLUDED.default_invoice_due_days,
        enabled_payment_methods = EXCLUDED.enabled_payment_methods,
        finance_contact_name = EXCLUDED.finance_contact_name,
        finance_contact_email = EXCLUDED.finance_contact_email,
        finance_contact_phone = EXCLUDED.finance_contact_phone,
        invoice_footer_i18n = EXCLUDED.invoice_footer_i18n,
        receipt_footer_i18n = EXCLUDED.receipt_footer_i18n,
        default_receipt_print_format = EXCLUDED.default_receipt_print_format,
        default_invoice_print_format = EXCLUDED.default_invoice_print_format,
        auto_open_receipt_after_payment = EXCLUDED.auto_open_receipt_after_payment,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING id
      `,
      [
        dto.schoolId,
        dto.defaultCurrencyCode?.trim().toUpperCase() || 'USD',
        dto.defaultInvoiceDueDays ?? 30,
        dto.enabledPaymentMethods
          ? JSON.stringify(dto.enabledPaymentMethods)
          : null,
        dto.financeContactName?.trim() || null,
        dto.financeContactEmail?.trim() || null,
        dto.financeContactPhone?.trim() || null,
        dto.invoiceFooterI18n ? JSON.stringify(dto.invoiceFooterI18n) : null,
        dto.receiptFooterI18n ? JSON.stringify(dto.receiptFooterI18n) : null,
        dto.defaultReceiptPrintFormat ?? 'THERMAL_80MM',
        dto.defaultInvoicePrintFormat ?? 'A4',
        dto.autoOpenReceiptAfterPayment ?? false,
        actorUserId,
      ],
    );

    await this.platformActivityService.record({
      eventType: 'FINANCE_SETTINGS_UPDATED',
      actorType: platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
      actorUserId,
      schoolId: dto.schoolId,
      summary: 'Finance settings were updated.',
      payload: {
        financeSettingsId: result.rows[0].id,
        schoolId: dto.schoolId,
      },
    });

    return this.getFinanceSettings(dto.schoolId, actorUserId, platformRole);
  }
  async assertUserCanAccessFinance(
    actorUserId: string,
    schoolId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const schoolResult = await this.db.query<{
      id: string;
      management_mode: 'SELF_MANAGED' | 'SUPERADMIN_MANAGED' | 'HYBRID_MANAGED';
    }>(
      `
      SELECT id, management_mode
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );

    const school = schoolResult.rows[0];

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found.`);
    }

    if (
      platformRole === 'SUPER_ADMIN' &&
      school.management_mode !== 'SELF_MANAGED'
    ) {
      return;
    }

    const membershipResult = await this.db.query<{
      role: string;
    }>(
      `
      SELECT smr.role::text AS role
      FROM school_memberships sm
      JOIN school_membership_roles smr
        ON smr.school_membership_id = sm.id
       AND smr.deleted_at IS NULL
      WHERE sm.user_id = $1
        AND sm.school_id = $2
        AND sm.deleted_at IS NULL
        AND sm.membership_status = 'ACTIVE'
        AND EXISTS (
          SELECT 1
          FROM school_staff_accounts staff
          WHERE staff.school_id = sm.school_id
            AND staff.user_id = sm.user_id
            AND staff.employment_status IN ('ACTIVE', 'ON_LEAVE')
            AND staff.deleted_at IS NULL
        )
      `,
      [actorUserId, schoolId],
    );

    const roles = membershipResult.rows.map((row) => row.role);

    if (!roles.includes('SCHOOL_ADMIN') && !roles.includes('FINANCE_ADMIN')) {
      throw new ForbiddenException(
        'You do not have permission to access finance operations.',
      );
    }
  }

  async getFinanceDashboard(
    query: {
      schoolId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      query.schoolId,
      platformRole,
    );

    const summaryResult = await this.db.query<{
      invoice_count: string;
      unpaid_invoice_count: string;
      paid_invoice_count: string;
      payment_count: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS invoice_count,
        COUNT(*) FILTER (WHERE balance_due > 0)::text AS unpaid_invoice_count,
        COUNT(*) FILTER (WHERE balance_due <= 0)::text AS paid_invoice_count,
        (
          SELECT COUNT(*)::text
          FROM payments
          WHERE school_id = $1
            AND deleted_at IS NULL
            AND payment_status <> 'CANCELLED'
            AND NOT EXISTS (
              SELECT 1
              FROM finance_payment_corrections correction
              WHERE correction.payment_id = payments.id
                AND correction.correction_status = 'COMPLETED'
            )
        ) AS payment_count
      FROM invoices
      WHERE school_id = $1
        AND deleted_at IS NULL
        AND invoice_status <> 'VOID'
      `,
      [query.schoolId],
    );

    const moneyResult = await this.db.query<{
      currency_code: string;
      total_invoiced: string;
      total_paid: string;
      total_balance_due: string;
    }>(
      `
      SELECT
        currency_code,
        COALESCE(SUM(total_amount), 0)::text AS total_invoiced,
        COALESCE(SUM(amount_paid), 0)::text AS total_paid,
        COALESCE(SUM(balance_due), 0)::text AS total_balance_due
      FROM invoices
      WHERE school_id = $1
        AND deleted_at IS NULL
        AND invoice_status <> 'VOID'
      GROUP BY currency_code
      ORDER BY currency_code
      `,
      [query.schoolId],
    );

    const recentInvoicesResult = await this.db.query<{
      id: string;
      invoice_number: string | null;
      invoice_title: string | null;
      invoice_status: string;
      issue_date: string | null;
      due_date: string | null;
      currency_code: string;
      total_amount: string;
      paid_amount: string;
      balance_due: string;
      student_id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
      created_at: string;
    }>(
      `
      SELECT
        inv.id,
        inv.invoice_number,
        inv.invoice_title,
        inv.invoice_status::text AS invoice_status,
        inv.issue_date::text AS issue_date,
        inv.due_date::text AS due_date,
        inv.currency_code,
        inv.total_amount::text AS total_amount,
        inv.amount_paid::text AS paid_amount,
        inv.balance_due::text AS balance_due,
        st.id AS student_id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.first_name,
        st.last_name,
        inv.created_at::text AS created_at
      FROM invoices inv
      JOIN students st
        ON st.id = inv.student_id
       AND st.deleted_at IS NULL
      WHERE inv.school_id = $1
        AND inv.deleted_at IS NULL
      ORDER BY inv.created_at DESC
      LIMIT 20
      `,
      [query.schoolId],
    );

    const recentPaymentsResult = await this.db.query<{
      id: string;
      payment_number: string | null;
      payment_status: string;
      payment_method: string | null;
      payment_reference: string | null;
      currency_code: string;
      amount: string;
      paid_at: string | null;
      invoice_id: string | null;
      invoice_number: string | null;
      student_id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
      created_at: string;
    }>(
      `
      SELECT
        pay.id,
        COALESCE(pay.payment_number, pay.receipt_number) AS payment_number,
        ${this.effectivePaymentStatusSql('pay')} AS payment_status,
        COALESCE(pay.payment_method::text, pay.method) AS payment_method,
        COALESCE(pay.payment_reference, pay.reference, pay.reference_no) AS payment_reference,
        pay.currency_code,
        pay.amount::text AS amount,
        COALESCE(pay.paid_at::text, pay.payment_date::text) AS paid_at,
        inv.id AS invoice_id,
        inv.invoice_number,
        st.id AS student_id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.first_name,
        st.last_name,
        pay.created_at::text AS created_at
      FROM payments pay
      JOIN students st
        ON st.id = pay.student_id
       AND st.deleted_at IS NULL
      LEFT JOIN invoices inv
        ON inv.id = pay.invoice_id
       AND inv.deleted_at IS NULL
      WHERE pay.school_id = $1
        AND pay.deleted_at IS NULL
      ORDER BY COALESCE(pay.paid_at, pay.payment_date::timestamptz, pay.created_at) DESC
      LIMIT 20
      `,
      [query.schoolId],
    );

    const summary = summaryResult.rows[0];

    return {
      totals: {
        invoiceCount: Number(summary.invoice_count),
        unpaidInvoiceCount: Number(summary.unpaid_invoice_count),
        paidInvoiceCount: Number(summary.paid_invoice_count),
        paymentCount: Number(summary.payment_count),
      },
      moneyByCurrency: moneyResult.rows.map((row) => ({
        currencyCode: row.currency_code,
        totalInvoiced: Number(row.total_invoiced),
        totalPaid: Number(row.total_paid),
        totalBalanceDue: Number(row.total_balance_due),
      })),
      recentInvoices: recentInvoicesResult.rows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        invoiceTitle: row.invoice_title,
        invoiceStatus: row.invoice_status,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        currencyCode: row.currency_code,
        totalAmount: Number(row.total_amount),
        paidAmount: Number(row.paid_amount),
        balanceDue: Number(row.balance_due),
        createdAt: row.created_at,
        student: {
          id: row.student_id,
          studentCode: row.student_code,
          firstName: row.first_name,
          lastName: row.last_name,
        },
      })),
      recentPayments: recentPaymentsResult.rows.map((row) => ({
        id: row.id,
        paymentNumber: row.payment_number,
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        paymentReference: row.payment_reference,
        currencyCode: row.currency_code,
        amount: Number(row.amount),
        paidAt: row.paid_at,
        createdAt: row.created_at,
        invoice: row.invoice_id
          ? {
              id: row.invoice_id,
              invoiceNumber: row.invoice_number,
            }
          : null,
        student: {
          id: row.student_id,
          studentCode: row.student_code,
          firstName: row.first_name,
          lastName: row.last_name,
        },
      })),
    };
  }
  async getOverview(schoolId: string) {
    const invoicesResult = await this.db.query<{
      total_invoices: string;
      draft_invoices: string;
      issued_invoices: string;
      partially_paid_invoices: string;
      paid_invoices: string;
      overdue_invoices: string;
      void_invoices: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS total_invoices,
        COUNT(*) FILTER (WHERE invoice_status = 'DRAFT')::text AS draft_invoices,
        COUNT(*) FILTER (WHERE invoice_status = 'ISSUED')::text AS issued_invoices,
        COUNT(*) FILTER (WHERE invoice_status = 'PARTIALLY_PAID')::text AS partially_paid_invoices,
        COUNT(*) FILTER (WHERE invoice_status = 'PAID')::text AS paid_invoices,
        COUNT(*) FILTER (
          WHERE (
            invoice_status = 'OVERDUE'
            OR (
              due_date IS NOT NULL
              AND due_date < CURRENT_DATE
              AND invoice_status NOT IN ('PAID', 'VOID')
              AND balance_due > 0
            )
          )
        )::text AS overdue_invoices,
        COUNT(*) FILTER (WHERE invoice_status = 'VOID')::text AS void_invoices
      FROM invoices
      WHERE school_id = $1
        AND deleted_at IS NULL
      `,
      [schoolId],
    );

    const paymentsResult = await this.db.query<{
      confirmed_payments: string;
      last_payment_at: string | null;
    }>(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE pay.payment_status = 'CONFIRMED'
            AND NOT EXISTS (
              SELECT 1
              FROM finance_payment_corrections correction
              WHERE correction.payment_id = pay.id
                AND correction.correction_status = 'COMPLETED'
            )
        )::text AS confirmed_payments,
        MAX(pay.payment_date) FILTER (
          WHERE pay.payment_status = 'CONFIRMED'
            AND NOT EXISTS (
              SELECT 1
              FROM finance_payment_corrections correction
              WHERE correction.payment_id = pay.id
                AND correction.correction_status = 'COMPLETED'
            )
        )::text AS last_payment_at
      FROM payments pay
      WHERE pay.school_id = $1
        AND pay.deleted_at IS NULL
      `,
      [schoolId],
    );

    const moneyResult = await this.db.query<{
      currency_code: string;
      total_billed: string;
      total_paid: string;
      total_outstanding: string;
      current_bucket: string;
      days_1_30: string;
      days_31_60: string;
      days_61_plus: string;
    }>(
      `
      SELECT
        currency_code,
        COALESCE(SUM(total_amount) FILTER (
          WHERE invoice_status <> 'VOID'
        ), 0)::text AS total_billed,
        COALESCE(SUM(amount_paid) FILTER (
          WHERE invoice_status <> 'VOID'
        ), 0)::text AS total_paid,
        COALESCE(SUM(balance_due) FILTER (
          WHERE invoice_status <> 'VOID'
        ), 0)::text AS total_outstanding,
        COALESCE(SUM(balance_due) FILTER (
          WHERE balance_due > 0
            AND (due_date IS NULL OR due_date >= CURRENT_DATE)
            AND invoice_status NOT IN ('PAID', 'VOID')
        ), 0)::text AS current_bucket,

        COALESCE(SUM(balance_due) FILTER (
          WHERE balance_due > 0
            AND due_date < CURRENT_DATE
            AND CURRENT_DATE - due_date BETWEEN 1 AND 30
            AND invoice_status NOT IN ('PAID', 'VOID')
        ), 0)::text AS days_1_30,

        COALESCE(SUM(balance_due) FILTER (
          WHERE balance_due > 0
            AND due_date < CURRENT_DATE
            AND CURRENT_DATE - due_date BETWEEN 31 AND 60
            AND invoice_status NOT IN ('PAID', 'VOID')
        ), 0)::text AS days_31_60,

        COALESCE(SUM(balance_due) FILTER (
          WHERE balance_due > 0
            AND due_date < CURRENT_DATE
            AND CURRENT_DATE - due_date > 60
            AND invoice_status NOT IN ('PAID', 'VOID')
        ), 0)::text AS days_61_plus
      FROM invoices
      WHERE school_id = $1
        AND deleted_at IS NULL
      GROUP BY currency_code
      ORDER BY currency_code
      `,
      [schoolId],
    );

    const invoices = invoicesResult.rows[0];
    const payments = paymentsResult.rows[0];

    return {
      schoolId,
      invoices: {
        total: Number(invoices.total_invoices),
        draft: Number(invoices.draft_invoices),
        issued: Number(invoices.issued_invoices),
        partiallyPaid: Number(invoices.partially_paid_invoices),
        paid: Number(invoices.paid_invoices),
        overdue: Number(invoices.overdue_invoices),
        void: Number(invoices.void_invoices),
      },
      moneyByCurrency: moneyResult.rows.map((row) => ({
        currencyCode: row.currency_code,
        totalBilled: Number(row.total_billed),
        totalPaid: Number(row.total_paid),
        totalOutstanding: Number(row.total_outstanding),
      })),
      payments: {
        confirmedPayments: Number(payments.confirmed_payments),
        lastPaymentAt: payments.last_payment_at,
      },
      agingByCurrency: moneyResult.rows.map((row) => ({
        currencyCode: row.currency_code,
        current: Number(row.current_bucket),
        days1To30: Number(row.days_1_30),
        days31To60: Number(row.days_31_60),
        days61Plus: Number(row.days_61_plus),
      })),
    };
  }

  async listInvoices(query: {
    schoolId: string;
    status?: string;
    search?: string;
  }) {
    const values: unknown[] = [query.schoolId];

    const where: string[] = ['inv.school_id = $1', 'inv.deleted_at IS NULL'];

    if (query.status) {
      values.push(query.status);
      where.push(`inv.invoice_status = $${values.length}`);
    }

    if (query.search?.trim()) {
      values.push(`%${query.search.trim().toLowerCase()}%`);
      where.push(`
        (
          LOWER(COALESCE(inv.invoice_number, '')) LIKE $${values.length}
          OR LOWER(COALESCE(st.first_name, '')) LIKE $${values.length}
          OR LOWER(COALESCE(st.last_name, '')) LIKE $${values.length}
          OR LOWER(COALESCE(st.student_code, st.student_number, '')) LIKE $${values.length}
        )
      `);
    }

    const result = await this.db.query<{
      id: string;
      invoice_number: string | null;
      invoice_title: string | null;
      invoice_status: string;
      issue_date: string;
      due_date: string | null;
      total_amount: string;
      amount_paid: string;
      balance_due: string;
      currency_code: string;
      student_id: string | null;
      student_number: string | null;
      first_name: string | null;
      last_name: string | null;
      days_overdue: string | null;
      created_at: string;
    }>(
      `
      SELECT
        inv.id,
        inv.invoice_number,
        inv.invoice_title,
        inv.invoice_status::text AS invoice_status,
        inv.issue_date::text AS issue_date,
        inv.due_date::text AS due_date,
        inv.total_amount::text AS total_amount,
        inv.amount_paid::text AS amount_paid,
        inv.balance_due::text AS balance_due,
        inv.currency_code,
        st.id AS student_id,
        COALESCE(st.student_code, st.student_number) AS student_number,
        st.first_name,
        st.last_name,
        CASE
          WHEN inv.due_date IS NOT NULL
           AND inv.due_date < CURRENT_DATE
           AND inv.invoice_status NOT IN ('PAID', 'VOID')
           AND inv.balance_due > 0
          THEN (CURRENT_DATE - inv.due_date)::text
          ELSE NULL
        END AS days_overdue,
        inv.created_at::text AS created_at
      FROM invoices inv
      LEFT JOIN students st ON st.id = inv.student_id
      WHERE ${where.join(' AND ')}
      ORDER BY
        inv.due_date ASC NULLS LAST,
        inv.created_at DESC
      LIMIT 200
      `,
      values,
    );

    return result.rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      invoiceStatus: row.invoice_status,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      totalAmount: Number(row.total_amount),
      amountPaid: Number(row.amount_paid),
      balanceDue: Number(row.balance_due),
      currencyCode: row.currency_code,
      student: row.student_id
        ? {
            id: row.student_id,
            code: row.student_number,
            firstName: row.first_name,
            lastName: row.last_name,
          }
        : null,
      daysOverdue: row.days_overdue === null ? null : Number(row.days_overdue),
      createdAt: row.created_at,
    }));
  }

  private buildInvoiceNumber(input: {
    schoolCode?: string | null;
    invoiceId: string;
    issueDate: string;
  }) {
    const datePart = input.issueDate.replaceAll('-', '');
    const shortId = input.invoiceId.slice(0, 8).toUpperCase();
    const schoolPart =
      input.schoolCode?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'SCH';

    return `INV-${schoolPart}-${datePart}-${shortId}`;
  }

  async createStudentInvoice(
    dto: CreateStudentInvoiceDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );

    const title = dto.invoiceTitle.trim();

    if (!title) {
      throw new BadRequestException('Invoice title is required.');
    }

    const totalAmount = Number(dto.totalAmount);

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new BadRequestException(
        'Invoice amount must be greater than zero.',
      );
    }

    return this.db.withTransaction(async (client) => {
      const settingsResult = await client.query<{
        default_currency_code: string;
        default_invoice_due_days: string;
      }>(
        `
        SELECT
          default_currency_code,
          default_invoice_due_days::text
        FROM school_finance_settings
        WHERE school_id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.schoolId],
      );

      const settings = settingsResult.rows[0];
      const issueDate = dto.issueDate ?? new Date().toISOString().slice(0, 10);
      const dueDate =
        dto.dueDate ??
        (settings
          ? this.addDays(issueDate, Number(settings.default_invoice_due_days))
          : this.addDays(issueDate, 30));
      const currencyCode =
        dto.currencyCode?.trim().toUpperCase() ||
        settings?.default_currency_code ||
        'USD';
      const invoiceStatus = dto.invoiceStatus ?? 'ISSUED';
      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        issueDate,
        'Invoice creation',
      );

      const studentResult = await client.query<{
        id: string;
        student_code: string | null;
        first_name: string | null;
        last_name: string | null;
      }>(
        `
        SELECT
          id,
          COALESCE(student_code, student_number) AS student_code,
          first_name,
          last_name
        FROM students
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.studentId, dto.schoolId],
      );

      const student = studentResult.rows[0];

      if (!student) {
        throw new NotFoundException('Student not found for this school.');
      }

      const academicContextResult = await client.query<{
        academic_year_id: string;
        grading_period_id: string | null;
      }>(
        `
        WITH student_year AS (
          SELECT en.academic_year_id
          FROM enrollments en
          WHERE en.student_id = $1
            AND en.deleted_at IS NULL
            AND en.enrollment_status = 'ACTIVE'
          ORDER BY en.created_at DESC
          LIMIT 1
        ), selected_year AS (
          SELECT ay.id
          FROM academic_years ay
          WHERE ay.school_id = $2
            AND ay.deleted_at IS NULL
            AND (
              ay.id = (SELECT academic_year_id FROM student_year)
              OR ay.status = 'ACTIVE'
              OR $3::date BETWEEN ay.start_date AND ay.end_date
            )
          ORDER BY
            CASE
              WHEN ay.id = (SELECT academic_year_id FROM student_year) THEN 0
              WHEN ay.status = 'ACTIVE' THEN 1
              WHEN $3::date BETWEEN ay.start_date AND ay.end_date THEN 2
              ELSE 3
            END,
            ay.start_date DESC
          LIMIT 1
        )
        SELECT
          sy.id AS academic_year_id,
          gp.id AS grading_period_id
        FROM selected_year sy
        LEFT JOIN LATERAL (
          SELECT id
          FROM grading_periods
          WHERE academic_year_id = sy.id
            AND deleted_at IS NULL
            AND (is_current = TRUE OR $3::date BETWEEN start_date AND end_date)
          ORDER BY
            is_current DESC,
            start_date DESC
          LIMIT 1
        ) gp ON TRUE
        `,
        [dto.studentId, dto.schoolId, issueDate],
      );

      let academicContext = academicContextResult.rows[0];

      if (!academicContext) {
        const issueYear = Number(issueDate.slice(0, 4));
        const fallbackYearResult = await client.query<{
          academic_year_id: string;
          grading_period_id: string | null;
        }>(
          `
          INSERT INTO academic_years (
            school_id,
            name_i18n,
            start_date,
            end_date,
            status
          )
          VALUES (
            $1,
            $2::jsonb,
            $3::date,
            $4::date,
            'ACTIVE'
          )
          RETURNING id AS academic_year_id, NULL::uuid AS grading_period_id
          `,
          [
            dto.schoolId,
            JSON.stringify({
              en: `Finance Year ${issueYear}`,
              fr: `Année financière ${issueYear}`,
            }),
            `${issueYear}-01-01`,
            `${issueYear}-12-31`,
          ],
        );

        academicContext = fallbackYearResult.rows[0];
      }

      const invoiceNumberResult = await client.query<{
        invoice_number: string;
      }>(
        `
        SELECT next_invoice_number($1) AS invoice_number
        `,
        [dto.schoolId],
      );

      const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;
      const invoiceIdResult = await client.query<{ id: string }>(
        'SELECT gen_random_uuid()::text AS id',
      );
      const invoiceId = invoiceIdResult.rows[0].id;

      const invoiceResult = await client.query<{
        id: string;
        invoice_number: string;
        invoice_title: string | null;
        invoice_status: string;
        issue_date: string | null;
        due_date: string | null;
        currency_code: string;
        total_amount: string;
        notes: string | null;
        created_at: string;
      }>(
        `
        INSERT INTO invoices (
          id,
          school_id,
          student_id,
          academic_year_id,
          grading_period_id,
          invoice_number,
          invoice_title,
          status,
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
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::invoice_status,
          $8::invoice_status,
          $9::date,
          $10::date,
          $11,
          0,
          $11,
          0,
          $11,
          $12,
          $13,
          $14
        )
        RETURNING
          id,
          invoice_number,
          invoice_title,
          invoice_status::text AS invoice_status,
          issue_date::text AS issue_date,
          due_date::text AS due_date,
          currency_code,
          total_amount::text AS total_amount,
          notes,
          created_at::text AS created_at
        `,
        [
          invoiceId,
          dto.schoolId,
          dto.studentId,
          academicContext.academic_year_id,
          academicContext.grading_period_id,
          invoiceNumber,
          title,
          invoiceStatus,
          issueDate,
          dueDate,
          totalAmount,
          currencyCode,
          dto.notes?.trim() || null,
          actorUserId,
        ],
      );

      await client.query(
        `
        INSERT INTO invoice_items (
          school_id,
          invoice_id,
          description,
          quantity,
          unit_amount,
          line_total
        )
        VALUES ($1, $2, $3, 1, $4, $4)
        `,
        [dto.schoolId, invoiceId, title, totalAmount],
      );

      const invoice = invoiceResult.rows[0];

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_INVOICE_CREATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Invoice ${invoice.invoice_number} created for ${student.first_name ?? ''} ${student.last_name ?? ''}.`,
        payload: {
          studentId: dto.studentId,
          studentCode: student.student_code,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          invoiceStatus: invoice.invoice_status,
          totalAmount: Number(invoice.total_amount),
          currencyCode: invoice.currency_code,
        },
      });

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceTitle: invoice.invoice_title,
        invoiceStatus: invoice.invoice_status,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        currencyCode: invoice.currency_code,
        totalAmount: Number(invoice.total_amount),
        notes: invoice.notes,
        createdAt: invoice.created_at,
      };
    });
  }
  async createInvoice(
    dto: CreateInvoiceDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
    idempotencyKeyValue?: string,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );

    const idempotencyKey = this.normalizeIdempotencyKey(idempotencyKeyValue);

    if (!dto.items?.length) {
      throw new BadRequestException('Invoice must contain at least one item.');
    }

    if (dto.issueDate && dto.dueDate && dto.dueDate < dto.issueDate) {
      throw new BadRequestException('Due date cannot be before issue date.');
    }

    const cleanItems = dto.items.map((item) => {
      const quantity = Number(item.quantity);
      const unitAmount = Number(item.unitAmount);
      const lineTotal = Number((quantity * unitAmount).toFixed(2));

      if (!item.description.trim()) {
        throw new BadRequestException(
          'Each invoice item must have a description.',
        );
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          'Invoice item quantity must be greater than zero.',
        );
      }

      if (!Number.isFinite(unitAmount) || unitAmount < 0) {
        throw new BadRequestException(
          'Invoice item unit amount cannot be negative.',
        );
      }

      return {
        description: item.description.trim(),
        quantity,
        unitAmount,
        lineTotal,
      };
    });

    const subtotalAmount = Number(
      cleanItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
    );
    const discountAmount = Number((dto.discountAmount ?? 0).toFixed(2));

    if (discountAmount > subtotalAmount) {
      throw new BadRequestException('Discount cannot exceed subtotal.');
    }

    const totalAmount = Number((subtotalAmount - discountAmount).toFixed(2));
    if (totalAmount <= 0) {
      throw new BadRequestException('Invoice total must be greater than zero.');
    }
    const balanceDue = totalAmount;
    const requestHash = this.requestHash({ dto, cleanItems });

    return this.db.withTransaction(async (client) => {
      const replay = await this.getIdempotentResponseTx<{
        id: string;
        invoiceNumber: string;
        schoolId: string;
        studentId: string;
        invoiceStatus: string;
        issueDate: string;
        dueDate: string;
        subtotalAmount: number;
        discountAmount: number;
        totalAmount: number;
        amountPaid: number;
        balanceDue: number;
        currencyCode: string;
        items: typeof cleanItems;
      }>(client, {
        schoolId: dto.schoolId,
        operationType: 'INVOICE_CREATE',
        idempotencyKey,
        requestHash,
        actorUserId,
      });
      if (replay) return replay;

      const schoolResult = await client.query<{ id: string }>(
        `
        SELECT id
        FROM schools
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.schoolId],
      );
      if (!schoolResult.rows[0]) {
        throw new NotFoundException(`School ${dto.schoolId} not found.`);
      }

      const settingsResult = await client.query<{
        default_currency_code: string;
        default_invoice_due_days: string;
      }>(
        `
        SELECT
          default_currency_code,
          default_invoice_due_days::text
        FROM school_finance_settings
        WHERE school_id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.schoolId],
      );
      const settings = settingsResult.rows[0];
      const issueDate = dto.issueDate ?? new Date().toISOString().slice(0, 10);
      const dueDate =
        dto.dueDate ??
        (settings
          ? this.addDays(issueDate, Number(settings.default_invoice_due_days))
          : this.addDays(issueDate, 30));
      if (dueDate < issueDate) {
        throw new BadRequestException('Due date cannot be before issue date.');
      }
      const currencyCode = (
        dto.currencyCode?.trim() ||
        settings?.default_currency_code ||
        'USD'
      ).toUpperCase();
      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        issueDate,
        'Invoice creation',
      );

      const studentResult = await client.query<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        student_number: string | null;
      }>(
        `
        SELECT
          id,
          first_name,
          last_name,
          COALESCE(student_code, student_number) AS student_number
        FROM students
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [dto.studentId, dto.schoolId],
      );
      const student = studentResult.rows[0];
      if (!student) {
        throw new NotFoundException('Student not found for this school.');
      }

      const academicContextResult = await client.query<{
        academic_year_id: string;
        grading_period_id: string | null;
      }>(
        `
        WITH student_year AS (
          SELECT en.academic_year_id
          FROM enrollments en
          WHERE en.student_id = $1
            AND en.deleted_at IS NULL
            AND en.enrollment_status = 'ACTIVE'
          ORDER BY en.created_at DESC
          LIMIT 1
        ), selected_year AS (
          SELECT ay.id
          FROM academic_years ay
          WHERE ay.school_id = $2
            AND ay.deleted_at IS NULL
            AND (
              ay.id = (SELECT academic_year_id FROM student_year)
              OR ay.status = 'ACTIVE'
              OR $3::date BETWEEN ay.start_date AND ay.end_date
            )
          ORDER BY
            CASE
              WHEN ay.id = (SELECT academic_year_id FROM student_year) THEN 0
              WHEN ay.status = 'ACTIVE' THEN 1
              WHEN $3::date BETWEEN ay.start_date AND ay.end_date THEN 2
              ELSE 3
            END,
            ay.start_date DESC
          LIMIT 1
        )
        SELECT
          sy.id AS academic_year_id,
          gp.id AS grading_period_id
        FROM selected_year sy
        LEFT JOIN LATERAL (
          SELECT id
          FROM grading_periods
          WHERE academic_year_id = sy.id
            AND deleted_at IS NULL
            AND (is_current = TRUE OR $3::date BETWEEN start_date AND end_date)
          ORDER BY is_current DESC, start_date DESC
          LIMIT 1
        ) gp ON TRUE
        `,
        [dto.studentId, dto.schoolId, issueDate],
      );
      const academicContext = academicContextResult.rows[0];
      if (!academicContext) {
        throw new BadRequestException(
          'An active academic year is required before creating an invoice.',
        );
      }

      const invoiceNumberResult = await client.query<{
        invoice_number: string;
      }>(`SELECT next_invoice_number($1) AS invoice_number`, [dto.schoolId]);
      const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;
      const invoiceIdResult = await client.query<{ id: string }>(
        'SELECT gen_random_uuid()::text AS id',
      );
      const invoiceId = invoiceIdResult.rows[0].id;
      const invoiceStatus = dto.invoiceStatus ?? 'ISSUED';

      await client.query(
        `
        INSERT INTO invoices (
          id,
          school_id,
          student_id,
          academic_year_id,
          grading_period_id,
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
          $1, $2, $3, $4, $5, $6, $7, $8::invoice_status, $9::date,
          $10::date, $11, $12, $13, 0, $14, $15, $16, $17
        )
        `,
        [
          invoiceId,
          dto.schoolId,
          dto.studentId,
          academicContext.academic_year_id,
          academicContext.grading_period_id,
          invoiceNumber,
          cleanItems[0].description,
          invoiceStatus,
          issueDate,
          dueDate,
          subtotalAmount,
          discountAmount,
          totalAmount,
          balanceDue,
          currencyCode,
          dto.notes?.trim() || null,
          actorUserId,
        ],
      );

      for (const item of cleanItems) {
        await client.query(
          `
          INSERT INTO invoice_items (
            school_id,
            invoice_id,
            description,
            quantity,
            unit_amount,
            line_total
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            dto.schoolId,
            invoiceId,
            item.description,
            item.quantity,
            item.unitAmount,
            item.lineTotal,
          ],
        );
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'INVOICE_CREATED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Invoice ${invoiceNumber} created for ${student.first_name ?? ''} ${student.last_name ?? ''}.`,
        payload: {
          invoiceId,
          invoiceNumber,
          studentId: dto.studentId,
          invoiceStatus,
          subtotalAmount,
          discountAmount,
          totalAmount,
          balanceDue,
          currencyCode,
          itemCount: cleanItems.length,
        },
      });

      const response = {
        id: invoiceId,
        invoiceNumber,
        schoolId: dto.schoolId,
        studentId: dto.studentId,
        invoiceStatus,
        issueDate,
        dueDate,
        subtotalAmount,
        discountAmount,
        totalAmount,
        amountPaid: 0,
        balanceDue,
        currencyCode,
        items: cleanItems,
      };
      await this.saveIdempotentResponseTx(client, {
        schoolId: dto.schoolId,
        operationType: 'INVOICE_CREATE',
        idempotencyKey,
        requestHash,
        responseBody: response,
        actorUserId,
      });
      return response;
    });
  }
  private resolveInvoiceStatus(input: {
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    dueDate: string | null;
    currentStatus: string;
  }) {
    if (input.currentStatus === 'VOID') {
      return 'VOID';
    }

    if (input.balanceDue <= 0) {
      return 'PAID';
    }

    if (input.amountPaid > 0 && input.balanceDue > 0) {
      if (input.dueDate && new Date(input.dueDate) < new Date()) {
        return 'OVERDUE';
      }

      return 'PARTIALLY_PAID';
    }

    if (input.dueDate && new Date(input.dueDate) < new Date()) {
      return 'OVERDUE';
    }

    return 'ISSUED';
  }

  private buildReceiptNumber(input: {
    schoolCode?: string | null;
    paymentId: string;
    paymentDate: string;
  }) {
    const datePart = input.paymentDate.replaceAll('-', '');
    const shortId = input.paymentId.slice(0, 8).toUpperCase();
    const schoolPart =
      input.schoolCode?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'SCH';

    return `REC-${schoolPart}-${datePart}-${shortId}`;
  }

  async recordStudentPayment(
    dto: RecordStudentPaymentDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      dto.schoolId,
      platformRole,
    );

    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException(
        'Payment amount must be greater than zero.',
      );
    }

    return this.db.withTransaction(async (client) => {
      const invoiceResult = await client.query<{
        id: string;
        invoice_number: string | null;
        invoice_status: string;
        student_id: string;
        currency_code: string;
        total_amount: string;
        amount_paid: string;
        balance_due: string;
        due_date: string | null;
        student_code: string | null;
        first_name: string | null;
        last_name: string | null;
      }>(
        `
        SELECT
          inv.id,
          inv.invoice_number,
          inv.invoice_status::text AS invoice_status,
          inv.student_id,
          inv.currency_code,
          inv.total_amount::text AS total_amount,
          inv.amount_paid::text AS amount_paid,
          inv.balance_due::text AS balance_due,
          inv.due_date::text AS due_date,
          COALESCE(st.student_code, st.student_number) AS student_code,
          st.first_name,
          st.last_name
        FROM invoices inv
        JOIN students st
          ON st.id = inv.student_id
         AND st.deleted_at IS NULL
        WHERE inv.id = $1
          AND inv.school_id = $2
          AND inv.student_id = $3
          AND inv.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [dto.invoiceId, dto.schoolId, dto.studentId],
      );

      const invoice = invoiceResult.rows[0];

      if (!invoice) {
        throw new NotFoundException('Invoice not found for this student.');
      }

      if (
        invoice.invoice_status === 'VOID' ||
        invoice.invoice_status === 'CANCELLED'
      ) {
        throw new BadRequestException(
          'Cannot record payment on a cancelled invoice.',
        );
      }

      if (invoice.invoice_status === 'DRAFT') {
        throw new BadRequestException(
          'Cannot record payment on a draft invoice. Issue the invoice first.',
        );
      }

      const totalAmount = Number(invoice.total_amount);
      const alreadyPaid = Number(invoice.amount_paid);
      const balanceBefore = Number(invoice.balance_due);

      if (balanceBefore <= 0) {
        throw new BadRequestException('Invoice is already fully paid.');
      }

      if (dto.amount > balanceBefore) {
        throw new BadRequestException(
          `Payment exceeds invoice balance. Current balance is ${balanceBefore}.`,
        );
      }

      const paymentNumberResult = await client.query<{
        payment_number: string;
      }>(
        `
        SELECT next_payment_number($1) AS payment_number
        `,
        [dto.schoolId],
      );

      const paymentNumber = paymentNumberResult.rows[0].payment_number;
      const paidAt = dto.paidAt || null;
      const paymentDate = paidAt
        ? paidAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        paymentDate,
        'Payment recording',
      );
      const paymentMethod = (dto.paymentMethod?.trim() || 'CASH').toUpperCase();
      const paymentReference = dto.paymentReference?.trim() || null;
      const currencyCode = invoice.currency_code;
      if (
        dto.currencyCode &&
        dto.currencyCode.trim().toUpperCase() !== currencyCode
      ) {
        throw new BadRequestException(
          'Payment currency must match the invoice currency.',
        );
      }
      await this.assertPaymentMethodEnabledTx(
        client,
        dto.schoolId,
        paymentMethod,
        paymentReference,
      );

      const paymentResult = await client.query<{
        id: string;
        payment_number: string;
        payment_status: string;
        payment_method: string | null;
        payment_reference: string | null;
        amount: string;
        paid_at: string | null;
        notes: string | null;
        created_at: string;
      }>(
        `
        INSERT INTO payments (
          school_id,
          student_id,
          invoice_id,
          payment_number,
          receipt_number,
          payment_status,
          status,
          payment_method,
          reference_no,
          payment_reference,
          payment_date,
          paid_at,
          method,
          reference,
          amount,
          currency_code,
          notes,
          recorded_by_user_id,
          received_by_user_id,
          receipt_generated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $4,
          'CONFIRMED'::payment_status,
          'RECORDED'::payment_status,
          $5::payment_method,
          $6::varchar,
          $6,
          COALESCE($7::date, CURRENT_DATE),
          COALESCE($7::timestamptz, NOW()),
          $5,
          $6,
          $8,
          $9,
          $10,
          $11,
          $11,
          NOW()
        )
        RETURNING
          id,
          payment_number,
          payment_status::text AS payment_status,
          payment_method::text AS payment_method,
          payment_reference,
          amount::text AS amount,
          paid_at::text AS paid_at,
          notes,
          created_at::text AS created_at
        `,
        [
          dto.schoolId,
          dto.studentId,
          dto.invoiceId,
          paymentNumber,
          paymentMethod,
          paymentReference,
          paidAt,
          dto.amount,
          currencyCode,
          dto.notes?.trim() || null,
          actorUserId,
        ],
      );

      const payment = paymentResult.rows[0];
      const paidAfter = alreadyPaid + Number(payment.amount);
      const balanceAfter = Number((totalAmount - paidAfter).toFixed(2));

      const nextInvoiceStatus =
        balanceAfter <= 0
          ? 'PAID'
          : paidAfter > 0
            ? 'PARTIALLY_PAID'
            : invoice.invoice_status;

      await client.query(
        `
        UPDATE invoices
        SET
          amount_paid = $3,
          balance_due = $4,
          invoice_status = $5::invoice_status,
          status = $5::invoice_status,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        `,
        [
          dto.invoiceId,
          dto.schoolId,
          paidAfter,
          balanceAfter,
          nextInvoiceStatus,
        ],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'STUDENT_PAYMENT_RECORDED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Payment ${payment.payment_number} recorded for invoice ${invoice.invoice_number ?? invoice.id}.`,
        payload: {
          studentId: dto.studentId,
          studentCode: invoice.student_code,
          invoiceId: dto.invoiceId,
          invoiceNumber: invoice.invoice_number,
          paymentId: payment.id,
          paymentNumber: payment.payment_number,
          amount: Number(payment.amount),
          currencyCode,
          invoiceStatus: nextInvoiceStatus,
        },
      });

      return {
        id: payment.id,
        paymentNumber: payment.payment_number,
        paymentStatus: payment.payment_status,
        paymentMethod: payment.payment_method,
        paymentReference: payment.payment_reference,
        currencyCode,
        amount: Number(payment.amount),
        paidAt: payment.paid_at,
        notes: payment.notes,
        createdAt: payment.created_at,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          invoiceStatus: nextInvoiceStatus,
          totalAmount,
          paidAmount: paidAfter,
          balanceDue: balanceAfter,
        },
      };
    });
  }
  async recordPayment(
    input: RecordPaymentDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
    idempotencyKeyValue?: string,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const idempotencyKey = this.normalizeIdempotencyKey(idempotencyKeyValue);
    const amount = Number(Number(input.amount).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        'Payment amount must be greater than zero.',
      );
    }
    const paymentMethod = (input.method?.trim() || 'CASH').toUpperCase();
    const paymentReference = input.reference?.trim() || null;
    const requestHash = this.requestHash({
      ...input,
      amount,
      method: paymentMethod,
      reference: paymentReference,
    });

    return this.db.withTransaction(async (client) => {
      const replay = await this.getIdempotentResponseTx<{
        paymentId: string;
        paymentNumber: string;
        receiptNumber: string;
        currencyCode: string;
        amount: number;
        invoice: {
          id: string;
          invoiceStatus: string;
          totalAmount: number;
          amountPaid: number;
          balanceDue: number;
        };
      }>(client, {
        schoolId: input.schoolId,
        operationType: 'PAYMENT_RECORD',
        idempotencyKey,
        requestHash,
        actorUserId,
      });
      if (replay) return replay;

      const invoiceResult = await client.query<{
        id: string;
        school_id: string;
        student_id: string | null;
        invoice_status: string;
        total_amount: string;
        amount_paid: string;
        balance_due: string;
        due_date: string | null;
        currency_code: string;
      }>(
        `
        SELECT
          id,
          school_id,
          student_id,
          invoice_status::text AS invoice_status,
          total_amount::text AS total_amount,
          amount_paid::text AS amount_paid,
          balance_due::text AS balance_due,
          due_date::text AS due_date,
          currency_code
        FROM invoices
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [input.invoiceId, input.schoolId],
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice) {
        throw new NotFoundException('Invoice not found for this school.');
      }
      if (invoice.invoice_status === 'VOID') {
        throw new ConflictException('Cannot record payment on a void invoice.');
      }
      if (invoice.invoice_status === 'DRAFT') {
        throw new ConflictException(
          'Cannot record payment on a draft invoice. Issue the invoice first.',
        );
      }

      const currentBalance = Number(invoice.balance_due);
      if (currentBalance <= 0) {
        throw new ConflictException('Invoice is already fully paid.');
      }
      if (amount > currentBalance) {
        throw new BadRequestException(
          `Payment amount cannot exceed the remaining balance of ${currentBalance}.`,
        );
      }
      await this.assertPaymentMethodEnabledTx(
        client,
        input.schoolId,
        paymentMethod,
        paymentReference,
      );

      const paymentNumberResult = await client.query<{
        payment_number: string;
      }>(`SELECT next_payment_number($1) AS payment_number`, [input.schoolId]);
      const paymentNumber = paymentNumberResult.rows[0].payment_number;
      const cashierSession =
        await this.cashierWorkflowService.assertOpenSessionTx(client, {
          sessionId: input.cashierSessionId,
          schoolId: input.schoolId,
          cashierUserId: actorUserId,
          currencyCode: invoice.currency_code,
          paymentDate: input.paymentDate,
        });
      const paymentDate = input.paymentDate ?? cashierSession.business_date;
      await assertFinanceDateOpen(
        client,
        input.schoolId,
        paymentDate,
        'Payment recording',
      );
      const paymentIdResult = await client.query<{ id: string }>(
        'SELECT gen_random_uuid()::text AS id',
      );
      const paymentId = paymentIdResult.rows[0].id;

      await client.query(
        `
        INSERT INTO payments (
          id,
          school_id,
          invoice_id,
          student_id,
          payment_number,
          receipt_number,
          payment_date,
          paid_at,
          amount,
          currency_code,
          payment_method,
          reference_no,
          payment_reference,
          recorded_by_user_id,
          payment_status,
          method,
          reference,
          notes,
          received_by_user_id,
          receipt_generated_at,
          cashier_session_id
        )
        VALUES (
          $1, $2, $3, $4, $5::text, $5::text, $6::date, $6::timestamptz, $7, $8,
          $9::payment_method, $10::varchar, $10, $11, 'CONFIRMED', $9,
          $10, $12, $11, NOW(), $13
        )
        `,
        [
          paymentId,
          input.schoolId,
          input.invoiceId,
          invoice.student_id,
          paymentNumber,
          paymentDate,
          amount,
          invoice.currency_code,
          paymentMethod,
          paymentReference,
          actorUserId,
          input.notes?.trim() || null,
          input.cashierSessionId,
        ],
      );

      const newAmountPaid = Number(
        (Number(invoice.amount_paid) + amount).toFixed(2),
      );
      const newBalanceDue = Number(
        (Number(invoice.total_amount) - newAmountPaid).toFixed(2),
      );
      const newStatus = this.resolveInvoiceStatus({
        totalAmount: Number(invoice.total_amount),
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        dueDate: invoice.due_date,
        currentStatus: invoice.invoice_status,
      });

      const updatedInvoiceResult = await client.query<{
        id: string;
        invoice_status: string;
        total_amount: string;
        amount_paid: string;
        balance_due: string;
      }>(
        `
        UPDATE invoices
        SET
          amount_paid = $3,
          balance_due = $4,
          invoice_status = $5::invoice_status,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        RETURNING
          id,
          invoice_status::text AS invoice_status,
          total_amount::text AS total_amount,
          amount_paid::text AS amount_paid,
          balance_due::text AS balance_due
        `,
        [
          input.invoiceId,
          input.schoolId,
          newAmountPaid,
          newBalanceDue,
          newStatus,
        ],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYMENT_RECORDED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: input.schoolId,
        summary: `Payment ${paymentNumber} recorded for invoice ${input.invoiceId}.`,
        payload: {
          paymentId,
          paymentNumber,
          receiptNumber: paymentNumber,
          invoiceId: input.invoiceId,
          studentId: invoice.student_id,
          amount,
          currencyCode: invoice.currency_code,
          paymentMethod,
          cashierSessionId: input.cashierSessionId,
          newInvoiceStatus: newStatus,
          newBalanceDue,
        },
      });

      const updatedInvoice = updatedInvoiceResult.rows[0];
      const response = {
        paymentId,
        paymentNumber,
        receiptNumber: paymentNumber,
        currencyCode: invoice.currency_code,
        amount,
        cashierSessionId: input.cashierSessionId,
        invoice: {
          id: updatedInvoice.id,
          invoiceStatus: updatedInvoice.invoice_status,
          totalAmount: Number(updatedInvoice.total_amount),
          amountPaid: Number(updatedInvoice.amount_paid),
          balanceDue: Number(updatedInvoice.balance_due),
        },
      };
      await this.saveIdempotentResponseTx(client, {
        schoolId: input.schoolId,
        operationType: 'PAYMENT_RECORD',
        idempotencyKey,
        requestHash,
        responseBody: response,
        actorUserId,
      });
      return response;
    });
  }
  async searchStudentsForFinance(
    input: {
      schoolId: string;
      search?: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const search = input.search?.trim().toLowerCase() ?? '';

    const result = await this.db.query<{
      id: string;
      student_number: string | null;
      first_name: string | null;
      last_name: string | null;
      grade_level_code: string | null;
      grade_level_name_i18n: Record<string, string> | null;
      section_code: string | null;
      section_name_i18n: Record<string, string> | null;
    }>(
      `
      SELECT
        st.id,
        COALESCE(st.student_code, st.student_number) AS student_number,
        st.first_name,
        st.last_name,
        gl.code AS grade_level_code,
        gl.name_i18n AS grade_level_name_i18n,
        se.code AS section_code,
        se.name_i18n AS section_name_i18n
      FROM students st
      LEFT JOIN enrollments en
        ON en.student_id = st.id
       AND en.deleted_at IS NULL
       AND en.enrollment_status = 'ACTIVE'
      LEFT JOIN sections se
        ON se.id = en.section_id
       AND se.deleted_at IS NULL
      LEFT JOIN grade_levels gl
        ON gl.id = se.grade_level_id
       AND gl.deleted_at IS NULL
      WHERE st.school_id = $1
        AND st.deleted_at IS NULL
        AND (
          $2 = ''
          OR LOWER(COALESCE(st.first_name, '')) LIKE '%' || $2 || '%'
          OR LOWER(COALESCE(st.last_name, '')) LIKE '%' || $2 || '%'
          OR LOWER(COALESCE(st.student_code, st.student_number, '')) LIKE '%' || $2 || '%'
          OR LOWER(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, ''))) LIKE '%' || $2 || '%'
        )
      ORDER BY
        st.last_name ASC NULLS LAST,
        st.first_name ASC NULLS LAST,
        COALESCE(st.student_code, st.student_number) ASC NULLS LAST
      LIMIT 20
      `,
      [input.schoolId, search],
    );

    return result.rows.map((row) => ({
      id: row.id,
      studentCode: row.student_number,
      firstName: row.first_name,
      lastName: row.last_name,
      gradeLevelCode: row.grade_level_code,
      gradeLevelNameI18n: row.grade_level_name_i18n,
      sectionCode: row.section_code,
      sectionNameI18n: row.section_name_i18n,
    }));
  }

  async getStudentFinanceSummary(
    input: {
      schoolId: string;
      studentId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const studentResult = await this.db.query<{
      id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
    }>(
      `
      SELECT
        id,
        COALESCE(student_code, student_number) AS student_code,
        first_name,
        last_name
      FROM students
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.studentId, input.schoolId],
    );

    const student = studentResult.rows[0];

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }

    const invoicesResult = await this.db.query<{
      id: string;
      invoice_number: string | null;
      invoice_status: string;
      issue_date: string | null;
      due_date: string | null;
      currency_code: string;
      total_amount: string;
      paid_amount: string;
      balance_due: string;
      created_at: string;
    }>(
      `
      SELECT
        inv.id,
        inv.invoice_number,
        inv.invoice_status::text AS invoice_status,
        inv.issue_date::text AS issue_date,
        inv.due_date::text AS due_date,
        inv.currency_code,
        inv.total_amount::text AS total_amount,
        inv.amount_paid::text AS paid_amount,
        inv.balance_due::text AS balance_due,
        inv.created_at::text AS created_at
      FROM invoices inv
      WHERE inv.school_id = $1
        AND inv.student_id = $2
        AND inv.deleted_at IS NULL
      ORDER BY inv.created_at DESC
      LIMIT 50
      `,
      [input.schoolId, input.studentId],
    );

    const paymentsResult = await this.db.query<{
      id: string;
      payment_number: string | null;
      invoice_id: string | null;
      invoice_number: string | null;
      payment_status: string;
      payment_method: string | null;
      payment_reference: string | null;
      currency_code: string;
      amount: string;
      paid_at: string | null;
      created_at: string;
    }>(
      `
      SELECT
        pay.id,
        COALESCE(pay.payment_number, pay.receipt_number) AS payment_number,
        pay.invoice_id,
        inv.invoice_number,
        ${this.effectivePaymentStatusSql('pay')} AS payment_status,
        COALESCE(pay.payment_method::text, pay.method) AS payment_method,
        COALESCE(pay.payment_reference, pay.reference, pay.reference_no) AS payment_reference,
        pay.currency_code,
        pay.amount::text AS amount,
        COALESCE(pay.paid_at::text, pay.payment_date::text) AS paid_at,
        pay.created_at::text AS created_at
      FROM payments pay
      LEFT JOIN invoices inv
        ON inv.id = pay.invoice_id
       AND inv.deleted_at IS NULL
      WHERE pay.school_id = $1
        AND pay.student_id = $2
        AND pay.deleted_at IS NULL
      ORDER BY COALESCE(pay.paid_at, pay.payment_date::timestamptz, pay.created_at) DESC
      LIMIT 50
      `,
      [input.schoolId, input.studentId],
    );

    const invoices = invoicesResult.rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      invoiceStatus: row.invoice_status,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      currencyCode: row.currency_code,
      totalAmount: Number(row.total_amount),
      paidAmount: Number(row.paid_amount),
      balanceDue: Number(row.balance_due),
      createdAt: row.created_at,
    }));

    const payments = paymentsResult.rows.map((row) => ({
      id: row.id,
      paymentNumber: row.payment_number,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      currencyCode: row.currency_code,
      amount: Number(row.amount),
      paidAt: row.paid_at,
      createdAt: row.created_at,
    }));

    const totalsByCurrency = Array.from(
      invoices
        .reduce(
          (totals, invoice) => {
            const current = totals.get(invoice.currencyCode) ?? {
              currencyCode: invoice.currencyCode,
              totalInvoiced: 0,
              totalPaid: 0,
              balanceDue: 0,
            };
            current.totalInvoiced = Number(
              (current.totalInvoiced + invoice.totalAmount).toFixed(2),
            );
            current.totalPaid = Number(
              (current.totalPaid + invoice.paidAmount).toFixed(2),
            );
            current.balanceDue = Number(
              (current.balanceDue + invoice.balanceDue).toFixed(2),
            );
            totals.set(invoice.currencyCode, current);
            return totals;
          },
          new Map<
            string,
            {
              currencyCode: string;
              totalInvoiced: number;
              totalPaid: number;
              balanceDue: number;
            }
          >(),
        )
        .values(),
    ).sort((left, right) =>
      left.currencyCode.localeCompare(right.currencyCode),
    );

    return {
      student: {
        id: student.id,
        studentCode: student.student_code,
        firstName: student.first_name,
        lastName: student.last_name,
      },
      totalsByCurrency,
      invoices,
      payments,
    };
  }
  async getStudentFinanceProfile(
    input: {
      schoolId: string;
      studentId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const studentResult = await this.db.query<{
      id: string;
      student_number: string | null;
      first_name: string | null;
      last_name: string | null;
    }>(
      `
      SELECT
        id,
        student_number,
        first_name,
        last_name
      FROM students
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.studentId, input.schoolId],
    );

    const student = studentResult.rows[0];

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }

    const summaryResult = await this.db.query<{
      invoice_count: string;
      overdue_count: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS invoice_count,
        COUNT(*) FILTER (
          WHERE balance_due > 0
            AND due_date IS NOT NULL
            AND due_date < CURRENT_DATE
            AND invoice_status NOT IN ('PAID', 'VOID')
        )::text AS overdue_count
      FROM invoices
      WHERE school_id = $1
        AND student_id = $2
        AND deleted_at IS NULL
      `,
      [input.schoolId, input.studentId],
    );

    const moneyResult = await this.db.query<{
      currency_code: string;
      total_billed: string;
      total_paid: string;
      total_outstanding: string;
    }>(
      `
      SELECT
        currency_code,
        COALESCE(SUM(total_amount), 0)::text AS total_billed,
        COALESCE(SUM(amount_paid), 0)::text AS total_paid,
        COALESCE(SUM(balance_due), 0)::text AS total_outstanding
      FROM invoices
      WHERE school_id = $1
        AND student_id = $2
        AND deleted_at IS NULL
        AND invoice_status <> 'VOID'
      GROUP BY currency_code
      ORDER BY currency_code
      `,
      [input.schoolId, input.studentId],
    );

    const invoicesResult = await this.db.query<{
      id: string;
      invoice_number: string | null;
      invoice_title: string | null;
      invoice_status: string;
      issue_date: string;
      due_date: string | null;
      subtotal_amount: string;
      discount_amount: string;
      total_amount: string;
      amount_paid: string;
      balance_due: string;
      currency_code: string;
      notes: string | null;
      days_overdue: string | null;
      created_at: string;
    }>(
      `
      SELECT
        id,
        invoice_number,
        invoice_status::text AS invoice_status,
        issue_date::text AS issue_date,
        due_date::text AS due_date,
        subtotal_amount::text AS subtotal_amount,
        discount_amount::text AS discount_amount,
        total_amount::text AS total_amount,
        amount_paid::text AS amount_paid,
        balance_due::text AS balance_due,
        currency_code,
        notes,
        CASE
          WHEN due_date IS NOT NULL
           AND due_date < CURRENT_DATE
           AND invoice_status NOT IN ('PAID', 'VOID')
           AND balance_due > 0
          THEN (CURRENT_DATE - due_date)::text
          ELSE NULL
        END AS days_overdue,
        created_at::text AS created_at
      FROM invoices
      WHERE school_id = $1
        AND student_id = $2
        AND deleted_at IS NULL
      ORDER BY issue_date DESC, created_at DESC
      `,
      [input.schoolId, input.studentId],
    );

    const paymentsResult = await this.db.query<{
      id: string;
      payment_number: string | null;
      invoice_id: string | null;
      invoice_number: string | null;
      payment_status: string;
      payment_date: string;
      amount: string;
      currency_code: string;
      method: string | null;
      reference: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `
      SELECT
        pay.id,
        COALESCE(pay.payment_number, pay.receipt_number) AS payment_number,
        pay.invoice_id,
        inv.invoice_number,
        ${this.effectivePaymentStatusSql('pay')} AS payment_status,
        COALESCE(pay.paid_at::text, pay.payment_date::text) AS payment_date,
        pay.amount::text AS amount,
        pay.currency_code,
        COALESCE(pay.payment_method::text, pay.method) AS method,
        COALESCE(pay.payment_reference, pay.reference, pay.reference_no) AS reference,
        pay.notes,
        pay.created_at::text AS created_at
      FROM payments pay
      LEFT JOIN invoices inv ON inv.id = pay.invoice_id
      WHERE pay.school_id = $1
        AND pay.student_id = $2
        AND pay.deleted_at IS NULL
      ORDER BY COALESCE(pay.paid_at, pay.payment_date::timestamptz, pay.created_at) DESC
      `,
      [input.schoolId, input.studentId],
    );

    const invoiceIds = invoicesResult.rows.map((row) => row.id);
    const itemsByInvoice = new Map<
      string,
      Array<{
        id: string;
        description: string;
        quantity: number;
        unitAmount: number;
        lineTotal: number;
      }>
    >();

    if (invoiceIds.length > 0) {
      const itemsResult = await this.db.query<{
        invoice_id: string;
        id: string;
        description: string;
        quantity: string;
        unit_amount: string;
        line_total: string;
      }>(
        `
        SELECT
          invoice_id,
          id,
          description,
          quantity::text AS quantity,
          unit_amount::text AS unit_amount,
          line_total::text AS line_total
        FROM invoice_items
        WHERE invoice_id = ANY($1::uuid[])
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        `,
        [invoiceIds],
      );

      for (const row of itemsResult.rows) {
        const existing = itemsByInvoice.get(row.invoice_id) ?? [];

        existing.push({
          id: row.id,
          description: row.description,
          quantity: Number(row.quantity),
          unitAmount: Number(row.unit_amount),
          lineTotal: Number(row.line_total),
        });

        itemsByInvoice.set(row.invoice_id, existing);
      }
    }

    const summary = summaryResult.rows[0];

    return {
      schoolId: input.schoolId,
      student: {
        id: student.id,
        code: student.student_number,
        firstName: student.first_name,
        lastName: student.last_name,
      },
      summary: {
        invoiceCount: Number(summary.invoice_count),
        overdueCount: Number(summary.overdue_count),
      },
      totalsByCurrency: moneyResult.rows.map((row) => ({
        currencyCode: row.currency_code,
        totalBilled: Number(row.total_billed),
        totalPaid: Number(row.total_paid),
        totalOutstanding: Number(row.total_outstanding),
      })),
      invoices: invoicesResult.rows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        invoiceStatus: row.invoice_status,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        subtotalAmount: Number(row.subtotal_amount),
        discountAmount: Number(row.discount_amount),
        totalAmount: Number(row.total_amount),
        amountPaid: Number(row.amount_paid),
        balanceDue: Number(row.balance_due),
        currencyCode: row.currency_code,
        notes: row.notes,
        daysOverdue:
          row.days_overdue === null ? null : Number(row.days_overdue),
        createdAt: row.created_at,
        items: itemsByInvoice.get(row.id) ?? [],
      })),
      payments: paymentsResult.rows.map((row) => ({
        id: row.id,
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number,
        paymentNumber: row.payment_number,
        paymentStatus: row.payment_status,
        paymentDate: row.payment_date,
        amount: Number(row.amount),
        currencyCode: row.currency_code,
        method: row.method,
        reference: row.reference,
        notes: row.notes,
        createdAt: row.created_at,
      })),
    };
  }

  async issueInvoice(
    input: {
      schoolId: string;
      invoiceId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    return this.db.withTransaction(async (client) => {
      const invoiceResult = await client.query<{
        id: string;
        invoice_number: string | null;
        invoice_status: string;
        total_amount: string;
        amount_paid: string;
        balance_due: string;
        due_date: string | null;
        issue_date: string;
      }>(
        `
        SELECT
          id,
          invoice_number,
          invoice_status::text AS invoice_status,
          total_amount::text AS total_amount,
          amount_paid::text AS amount_paid,
          balance_due::text AS balance_due,
          due_date::text AS due_date,
          issue_date::text AS issue_date
        FROM invoices
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [input.invoiceId, input.schoolId],
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice) {
        throw new NotFoundException('Invoice not found for this school.');
      }
      await assertFinanceDateOpen(
        client,
        input.schoolId,
        invoice.issue_date,
        'Invoice issue',
      );
      if (invoice.invoice_status !== 'DRAFT') {
        throw new ConflictException(
          `Only draft invoices can be issued. Current status: ${invoice.invoice_status}.`,
        );
      }

      const newStatus = this.resolveInvoiceStatus({
        totalAmount: Number(invoice.total_amount),
        amountPaid: Number(invoice.amount_paid),
        balanceDue: Number(invoice.balance_due),
        dueDate: invoice.due_date,
        currentStatus: 'ISSUED',
      });
      const result = await client.query<{
        id: string;
        invoice_status: string;
        invoice_number: string | null;
      }>(
        `
        UPDATE invoices
        SET invoice_status = $3::invoice_status, updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
          AND invoice_status = 'DRAFT'
          AND deleted_at IS NULL
        RETURNING id, invoice_status::text AS invoice_status, invoice_number
        `,
        [input.invoiceId, input.schoolId, newStatus],
      );

      await this.platformActivityService.recordTx(client, {
        eventType: 'INVOICE_ISSUED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: input.schoolId,
        summary: `Invoice ${invoice.invoice_number ?? input.invoiceId} issued.`,
        payload: {
          invoiceId: input.invoiceId,
          invoiceNumber: invoice.invoice_number,
          previousStatus: invoice.invoice_status,
          newStatus,
        },
      });
      return result.rows[0];
    });
  }

  async voidInvoice(
    input: {
      schoolId: string;
      invoiceId: string;
      reason?: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );
    const reason = input.reason?.trim();
    if (!reason) {
      throw new BadRequestException('A void reason is required.');
    }

    return this.db.withTransaction(async (client) => {
      const invoiceResult = await client.query<{
        id: string;
        invoice_number: string | null;
        invoice_status: string;
        amount_paid: string;
        issue_date: string;
      }>(
        `
        SELECT
          id,
          invoice_number,
          invoice_status::text AS invoice_status,
          amount_paid::text AS amount_paid,
          issue_date::text AS issue_date
        FROM invoices
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [input.invoiceId, input.schoolId],
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice) {
        throw new NotFoundException('Invoice not found for this school.');
      }
      await assertFinanceDateOpen(
        client,
        input.schoolId,
        invoice.issue_date,
        'Invoice void',
      );
      if (invoice.invoice_status === 'VOID') {
        throw new ConflictException('Invoice is already void.');
      }
      if (Number(invoice.amount_paid) > 0) {
        throw new ConflictException(
          'Cannot void an invoice with confirmed payments. Reverse the payments first.',
        );
      }

      const result = await client.query<{
        id: string;
        invoice_status: string;
        invoice_number: string | null;
      }>(
        `
        UPDATE invoices inv
        SET
          invoice_status = 'VOID',
          updated_at = NOW(),
          notes = CONCAT(COALESCE(notes, ''), E'\nVoid reason: ', $3::text)
        WHERE inv.id = $1
          AND inv.school_id = $2
          AND inv.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM payments pay
            WHERE pay.invoice_id = inv.id
              AND pay.school_id = inv.school_id
              AND pay.payment_status = 'CONFIRMED'
              AND pay.deleted_at IS NULL
          )
        RETURNING
          inv.id,
          inv.invoice_status::text AS invoice_status,
          inv.invoice_number
        `,
        [input.invoiceId, input.schoolId, reason],
      );
      if (!result.rows[0]) {
        throw new ConflictException(
          'The invoice received a payment and can no longer be voided.',
        );
      }

      await this.platformActivityService.recordTx(client, {
        eventType: 'INVOICE_VOIDED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: input.schoolId,
        summary: `Invoice ${invoice.invoice_number ?? input.invoiceId} voided.`,
        payload: {
          invoiceId: input.invoiceId,
          invoiceNumber: invoice.invoice_number,
          previousStatus: invoice.invoice_status,
          newStatus: 'VOID',
          reason,
        },
      });
      return result.rows[0];
    });
  }
  async getPaymentReceiptDetails(
    input: {
      schoolId: string;
      paymentId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const result = await this.db.query<{
      payment_id: string;
      payment_number: string | null;
      payment_status: string;
      payment_method: string | null;
      payment_reference: string | null;
      payment_currency_code: string;
      payment_amount: string;
      paid_at: string | null;
      payment_notes: string | null;
      invoice_id: string | null;
      invoice_number: string | null;
      invoice_title: string | null;
      invoice_status: string | null;
      invoice_currency_code: string | null;
      invoice_total_amount: string | null;
      student_id: string;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
      school_name: string;
      school_code: string | null;
    }>(
      `
      SELECT
        pay.id AS payment_id,
        COALESCE(pay.payment_number, pay.receipt_number) AS payment_number,
        ${this.effectivePaymentStatusSql('pay')} AS payment_status,
        COALESCE(pay.payment_method::text, pay.method) AS payment_method,
        COALESCE(pay.payment_reference, pay.reference, pay.reference_no) AS payment_reference,
        COALESCE(inv.currency_code, 'USD') AS payment_currency_code,
        pay.amount::text AS payment_amount,
        COALESCE(pay.paid_at::text, pay.payment_date::text) AS paid_at,
        pay.notes AS payment_notes,

        inv.id AS invoice_id,
        inv.invoice_number,
        inv.invoice_title,
        inv.invoice_status::text AS invoice_status,
        inv.currency_code AS invoice_currency_code,
        inv.total_amount::text AS invoice_total_amount,

        st.id AS student_id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.first_name,
        st.last_name,

        sc.name AS school_name,
        sc.code AS school_code
      FROM payments pay
      JOIN students st
        ON st.id = pay.student_id
       AND st.deleted_at IS NULL
      JOIN schools sc
        ON sc.id = pay.school_id
       AND sc.deleted_at IS NULL
      LEFT JOIN invoices inv
        ON inv.id = pay.invoice_id
       AND inv.deleted_at IS NULL
      WHERE pay.id = $1
        AND pay.school_id = $2
        AND pay.deleted_at IS NULL
      LIMIT 1
      `,
      [input.paymentId, input.schoolId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException('Payment not found for this school.');
    }

    return {
      payment: {
        id: row.payment_id,
        paymentNumber: row.payment_number,
        paymentStatus: row.payment_status,
        paymentMethod: row.payment_method,
        paymentReference: row.payment_reference,
        currencyCode: row.payment_currency_code,
        amount: Number(row.payment_amount),
        paidAt: row.paid_at,
        notes: row.payment_notes,
      },
      invoice: row.invoice_id
        ? {
            id: row.invoice_id,
            invoiceNumber: row.invoice_number,
            invoiceTitle: row.invoice_title,
            invoiceStatus: row.invoice_status,
            currencyCode: row.invoice_currency_code,
            totalAmount:
              row.invoice_total_amount === null
                ? null
                : Number(row.invoice_total_amount),
          }
        : null,
      student: {
        id: row.student_id,
        studentCode: row.student_code,
        firstName: row.first_name,
        lastName: row.last_name,
      },
      school: {
        name: row.school_name,
        code: row.school_code,
      },
    };
  }
  async getPaymentReceipt(
    input: {
      schoolId: string;
      paymentId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const result = await this.db.query<{
      payment_id: string;
      receipt_number: string | null;
      receipt_generated_at: string | null;
      payment_status: string;
      payment_date: string;
      amount: string;
      method: string | null;
      reference: string | null;
      payment_notes: string | null;
      created_at: string;
      invoice_id: string | null;
      invoice_number: string | null;
      invoice_status: string | null;
      currency_code: string | null;
      total_amount: string | null;
      amount_paid: string | null;
      balance_due: string | null;
      student_id: string | null;
      student_code: string | null;
      first_name: string | null;
      last_name: string | null;
      school_id: string;
      school_name: string;
      school_code: string;
      logo_url: string | null;
      address_line1: string | null;
      address_line2: string | null;
      city: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      finance_contact_name: string | null;
      finance_contact_email: string | null;
      finance_contact_phone: string | null;
      receipt_footer_i18n: Record<string, string> | null;
    }>(
      `
      SELECT
        pay.id AS payment_id,
        pay.receipt_number,
        pay.receipt_generated_at::text AS receipt_generated_at,
        ${this.effectivePaymentStatusSql('pay')} AS payment_status,
        pay.payment_date::text AS payment_date,
        pay.amount::text AS amount,
        pay.method,
        pay.reference,
        pay.notes AS payment_notes,
        pay.created_at::text AS created_at,

        inv.id AS invoice_id,
        inv.invoice_number,
        inv.invoice_status::text AS invoice_status,
        inv.currency_code,
        inv.total_amount::text AS total_amount,
        inv.amount_paid::text AS amount_paid,
        inv.balance_due::text AS balance_due,

        st.id AS student_id,
        COALESCE(st.student_code, st.student_number) AS student_code,
        st.first_name,
        st.last_name,

        s.id AS school_id,
        s.name AS school_name,
        s.code AS school_code,
        s.logo_url,
        s.address_line1,
        s.address_line2,
        s.city,
        s.phone,
        s.email,
        s.website,
        fs.finance_contact_name,
        fs.finance_contact_email,
        fs.finance_contact_phone,
        fs.receipt_footer_i18n

      FROM payments pay
      JOIN schools s ON s.id = pay.school_id
      LEFT JOIN school_finance_settings fs
        ON fs.school_id = s.id
       AND fs.deleted_at IS NULL
      LEFT JOIN invoices inv ON inv.id = pay.invoice_id
      LEFT JOIN students st ON st.id = pay.student_id
      WHERE pay.id = $1
        AND pay.school_id = $2
        AND pay.deleted_at IS NULL
        AND s.deleted_at IS NULL
      LIMIT 1
      `,
      [input.paymentId, input.schoolId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException('Payment receipt not found for this school.');
    }

    let receiptNumber = row.receipt_number;

    if (!receiptNumber) {
      receiptNumber = this.buildReceiptNumber({
        schoolCode: row.school_code,
        paymentId: row.payment_id,
        paymentDate: row.payment_date,
      });

      await this.db.query(
        `
        UPDATE payments
        SET
          receipt_number = $2,
          receipt_generated_at = COALESCE(receipt_generated_at, NOW()),
          updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        `,
        [row.payment_id, receiptNumber],
      );
    }

    return {
      id: row.payment_id,
      receiptNumber,
      receiptGeneratedAt: row.receipt_generated_at,
      paymentStatus: row.payment_status,
      paymentDate: row.payment_date,
      amount: Number(row.amount),
      method: row.method,
      reference: row.reference,
      notes: row.payment_notes,
      createdAt: row.created_at,
      school: {
        id: row.school_id,
        name: row.school_name,
        code: row.school_code,
        logoUrl: row.logo_url,
        addressLine1: row.address_line1,
        addressLine2: row.address_line2,
        city: row.city,
        phone: row.phone,
        email: row.email,
        website: row.website,
        financeSettings: {
          financeContactName: row.finance_contact_name,
          financeContactEmail: row.finance_contact_email,
          financeContactPhone: row.finance_contact_phone,
          receiptFooterI18n: row.receipt_footer_i18n ?? {},
        },
      },
      invoice: row.invoice_id
        ? {
            id: row.invoice_id,
            invoiceNumber: row.invoice_number,
            invoiceStatus: row.invoice_status,
            currencyCode: row.currency_code ?? 'USD',
            totalAmount:
              row.total_amount === null ? null : Number(row.total_amount),
            amountPaid:
              row.amount_paid === null ? null : Number(row.amount_paid),
            balanceDue:
              row.balance_due === null ? null : Number(row.balance_due),
          }
        : null,
      student: row.student_id
        ? {
            id: row.student_id,
            code: row.student_code,
            firstName: row.first_name,
            lastName: row.last_name,
          }
        : null,
    };
  }
  async getInvoiceDetails(
    input: {
      schoolId: string;
      invoiceId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const invoiceResult = await this.db.query<{
      id: string;
      school_id: string;
      invoice_number: string | null;
      invoice_title: string | null;
      invoice_status: string;
      issue_date: string;
      due_date: string | null;
      subtotal_amount: string;
      discount_amount: string;
      total_amount: string;
      amount_paid: string;
      balance_due: string;
      currency_code: string;
      notes: string | null;
      created_at: string;
      student_id: string | null;
      student_number: string | null;
      first_name: string | null;
      last_name: string | null;
      school_name: string;
      school_code: string;
      logo_url: string | null;
      address_line1: string | null;
      address_line2: string | null;
      city: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      finance_contact_name: string | null;
      finance_contact_email: string | null;
      finance_contact_phone: string | null;
      invoice_footer_i18n: Record<string, string> | null;
      default_invoice_print_format: string | null;
    }>(
      `
      SELECT
        inv.id,
        inv.school_id,
        inv.invoice_number,
        inv.invoice_title,
        inv.invoice_status::text AS invoice_status,
        inv.issue_date::text AS issue_date,
        inv.due_date::text AS due_date,
        inv.subtotal_amount::text AS subtotal_amount,
        inv.discount_amount::text AS discount_amount,
        inv.total_amount::text AS total_amount,
        inv.amount_paid::text AS amount_paid,
        inv.balance_due::text AS balance_due,
        inv.currency_code,
        inv.notes,
        inv.created_at::text AS created_at,

        st.id AS student_id,
        COALESCE(st.student_code, st.student_number) AS student_number,
        st.first_name,
        st.last_name,

        s.name AS school_name,
        s.code AS school_code,
        s.logo_url,
        s.address_line1,
        s.address_line2,
        s.city,
        s.phone,
        s.email,
        s.website,
        fs.finance_contact_name,
        fs.finance_contact_email,
        fs.finance_contact_phone,
        fs.invoice_footer_i18n,
        fs.default_invoice_print_format

      FROM invoices inv
      JOIN schools s ON s.id = inv.school_id
      LEFT JOIN school_finance_settings fs
        ON fs.school_id = s.id
       AND fs.deleted_at IS NULL
      LEFT JOIN students st ON st.id = inv.student_id
      WHERE inv.id = $1
        AND inv.school_id = $2
        AND inv.deleted_at IS NULL
        AND s.deleted_at IS NULL
      LIMIT 1
      `,
      [input.invoiceId, input.schoolId],
    );

    const invoice = invoiceResult.rows[0];

    if (!invoice) {
      throw new NotFoundException('Invoice not found for this school.');
    }

    const itemsResult = await this.db.query<{
      id: string;
      description: string;
      quantity: string;
      unit_amount: string;
      line_total: string;
    }>(
      `
      SELECT
        id,
        description,
        quantity::text AS quantity,
        unit_amount::text AS unit_amount,
        line_total::text AS line_total
      FROM invoice_items
      WHERE invoice_id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      `,
      [input.invoiceId, input.schoolId],
    );

    const paymentsResult = await this.db.query<{
      id: string;
      payment_number: string | null;
      payment_status: string;
      payment_date: string;
      amount: string;
      method: string | null;
      reference: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `
      SELECT
        id,
        COALESCE(payment_number, receipt_number) AS payment_number,
        ${this.effectivePaymentStatusSql('pay')} AS payment_status,
        COALESCE(paid_at::text, payment_date::text) AS payment_date,
        amount::text AS amount,
        COALESCE(payment_method::text, method) AS method,
        COALESCE(payment_reference, reference, reference_no) AS reference,
        notes,
        created_at::text AS created_at
      FROM payments pay
      WHERE invoice_id = $1
        AND school_id = $2
        AND deleted_at IS NULL
        AND payment_status <> 'CANCELLED'
      ORDER BY COALESCE(paid_at, payment_date::timestamptz, created_at) DESC
      `,
      [input.invoiceId, input.schoolId],
    );

    return {
      id: invoice.id,
      school: {
        id: invoice.school_id,
        name: invoice.school_name,
        code: invoice.school_code,
        logoUrl: invoice.logo_url,
        addressLine1: invoice.address_line1,
        addressLine2: invoice.address_line2,
        city: invoice.city,
        phone: invoice.phone,
        email: invoice.email,
        website: invoice.website,
        financeSettings: {
          financeContactName: invoice.finance_contact_name,
          financeContactEmail: invoice.finance_contact_email,
          financeContactPhone: invoice.finance_contact_phone,
          invoiceFooterI18n: invoice.invoice_footer_i18n ?? {},
          defaultInvoicePrintFormat:
            invoice.default_invoice_print_format === 'THERMAL_80MM'
              ? 'THERMAL_80MM'
              : 'A4',
        },
      },
      student: invoice.student_id
        ? {
            id: invoice.student_id,
            code: invoice.student_number,
            firstName: invoice.first_name,
            lastName: invoice.last_name,
          }
        : null,
      invoiceNumber: invoice.invoice_number,
      invoiceTitle: invoice.invoice_title,
      invoiceStatus: invoice.invoice_status,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      subtotalAmount: Number(invoice.subtotal_amount),
      discountAmount: Number(invoice.discount_amount),
      totalAmount: Number(invoice.total_amount),
      amountPaid: Number(invoice.amount_paid),
      balanceDue: Number(invoice.balance_due),
      currencyCode: invoice.currency_code,
      notes: invoice.notes,
      createdAt: invoice.created_at,
      items: itemsResult.rows.map((row) => ({
        id: row.id,
        description: row.description,
        quantity: Number(row.quantity),
        unitAmount: Number(row.unit_amount),
        lineTotal: Number(row.line_total),
      })),
      payments: paymentsResult.rows.map((row) => ({
        id: row.id,
        paymentNumber: row.payment_number,
        paymentStatus: row.payment_status,
        paymentDate: row.payment_date,
        amount: Number(row.amount),
        method: row.method,
        reference: row.reference,
        notes: row.notes,
        createdAt: row.created_at,
      })),
    };
  }
  async listInvoicePayments(
    input: {
      schoolId: string;
      invoiceId: string;
    },
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    await this.assertUserCanAccessFinance(
      actorUserId,
      input.schoolId,
      platformRole,
    );

    const invoiceResult = await this.db.query(
      `
      SELECT id
      FROM invoices
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [input.invoiceId, input.schoolId],
    );

    if (!invoiceResult.rows[0]) {
      throw new NotFoundException('Invoice not found for this school.');
    }

    const result = await this.db.query<{
      id: string;
      payment_status: string;
      payment_date: string;
      amount: string;
      method: string | null;
      reference: string | null;
      notes: string | null;
      received_by_user_id: string | null;
      created_at: string;
    }>(
      `
      SELECT
        id,
        COALESCE(payment_number, receipt_number) AS payment_number,
        ${this.effectivePaymentStatusSql('pay')} AS payment_status,
        COALESCE(paid_at::text, payment_date::text) AS payment_date,
        amount::text AS amount,
        COALESCE(payment_method::text, method) AS method,
        COALESCE(payment_reference, reference, reference_no) AS reference,
        notes,
        received_by_user_id,
        created_at::text AS created_at
      FROM payments pay
      WHERE invoice_id = $1
        AND school_id = $2
        AND deleted_at IS NULL
        AND payment_status <> 'CANCELLED'
      ORDER BY COALESCE(paid_at, payment_date::timestamptz, created_at) DESC
      `,
      [input.invoiceId, input.schoolId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      paymentStatus: row.payment_status,
      paymentDate: row.payment_date,
      amount: Number(row.amount),
      method: row.method,
      reference: row.reference,
      notes: row.notes,
      receivedByUserId: row.received_by_user_id,
      createdAt: row.created_at,
    }));
  }
}
