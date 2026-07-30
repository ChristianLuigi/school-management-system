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
import { ProcessPaymentCorrectionDto } from './dto/process-payment-correction.dto';
import { RequestCreditNoteDto } from './dto/request-credit-note.dto';
import { RequestPaymentCorrectionDto } from './dto/request-payment-correction.dto';
import { ReviewFinanceCorrectionDto } from './dto/review-finance-correction.dto';
import { assertFinanceDateOpen } from './security/finance-period-policy';

type PlatformRole = 'SUPER_ADMIN' | null;

type PaymentCorrectionRow = {
  id: string;
  school_id: string;
  payment_id: string;
  invoice_id: string;
  student_id: string;
  correction_type: 'REVERSAL' | 'REFUND';
  correction_status:
    | 'PENDING_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'COMPLETED';
  amount: string;
  currency_code: string;
  reason: string;
  requested_by_user_id: string;
  requested_at: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  processed_by_user_id: string | null;
  processed_at: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  cashier_session_id: string | null;
  payment_number: string | null;
  payment_method: string | null;
  invoice_number: string | null;
  student_code: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_email: string;
  reviewer_first_name: string | null;
  reviewer_last_name: string | null;
  processor_first_name: string | null;
  processor_last_name: string | null;
};

type CreditNoteRow = {
  id: string;
  school_id: string;
  invoice_id: string;
  student_id: string;
  credit_note_number: string;
  credit_note_status: 'PENDING_REVIEW' | 'APPLIED' | 'REJECTED';
  amount: string;
  currency_code: string;
  reason: string;
  requested_by_user_id: string;
  requested_at: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  invoice_number: string | null;
  invoice_status: string;
  invoice_total_amount: string;
  invoice_amount_paid: string;
  invoice_balance_due: string;
  student_code: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_email: string;
  reviewer_first_name: string | null;
  reviewer_last_name: string | null;
};

@Injectable()
export class FinanceCorrectionsService {
  constructor(
    private readonly db: DbService,
    private readonly cashierWorkflowService: CashierWorkflowService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  private idempotencyKey(value: string | undefined) {
    const key = value?.trim() ?? '';
    if (
      key.length < 8 ||
      key.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(key)
    ) {
      throw new BadRequestException(
        'A valid Idempotency-Key header is required.',
      );
    }
    return key;
  }

  private requestHash(input: unknown) {
    return createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }

  private async recordEventTx(
    client: PoolClient,
    input: {
      schoolId: string;
      subjectType: 'PAYMENT_CORRECTION' | 'CREDIT_NOTE';
      subjectId: string;
      eventType: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
      actorUserId: string;
      payload?: Record<string, unknown>;
    },
  ) {
    await client.query(
      `
      INSERT INTO finance_correction_events (
        school_id,
        subject_type,
        subject_id,
        event_type,
        actor_user_id,
        event_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        input.schoolId,
        input.subjectType,
        input.subjectId,
        input.eventType,
        input.actorUserId,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  }

  private paymentCorrectionSelect() {
    return `
      SELECT
        correction.id,
        correction.school_id,
        correction.payment_id,
        correction.invoice_id,
        correction.student_id,
        correction.correction_type,
        correction.correction_status,
        correction.amount::text AS amount,
        correction.currency_code,
        correction.reason,
        correction.requested_by_user_id,
        correction.requested_at::text AS requested_at,
        correction.reviewed_by_user_id,
        correction.reviewed_at::text AS reviewed_at,
        correction.review_note,
        correction.processed_by_user_id,
        correction.processed_at::text AS processed_at,
        correction.refund_method,
        correction.refund_reference,
        correction.cashier_session_id,
        COALESCE(payment.payment_number, payment.receipt_number) AS payment_number,
        COALESCE(payment.payment_method::text, payment.method) AS payment_method,
        invoice.invoice_number,
        COALESCE(student.student_code, student.student_number) AS student_code,
        student.first_name AS student_first_name,
        student.last_name AS student_last_name,
        requester.first_name AS requester_first_name,
        requester.last_name AS requester_last_name,
        requester.email_original AS requester_email,
        reviewer.first_name AS reviewer_first_name,
        reviewer.last_name AS reviewer_last_name,
        processor.first_name AS processor_first_name,
        processor.last_name AS processor_last_name
      FROM finance_payment_corrections correction
      JOIN payments payment
        ON payment.id = correction.payment_id
       AND payment.deleted_at IS NULL
      JOIN invoices invoice
        ON invoice.id = correction.invoice_id
       AND invoice.deleted_at IS NULL
      JOIN students student
        ON student.id = correction.student_id
       AND student.deleted_at IS NULL
      JOIN users requester
        ON requester.id = correction.requested_by_user_id
       AND requester.deleted_at IS NULL
      LEFT JOIN users reviewer
        ON reviewer.id = correction.reviewed_by_user_id
       AND reviewer.deleted_at IS NULL
      LEFT JOIN users processor
        ON processor.id = correction.processed_by_user_id
       AND processor.deleted_at IS NULL
    `;
  }

  private creditNoteSelect() {
    return `
      SELECT
        credit.id,
        credit.school_id,
        credit.invoice_id,
        credit.student_id,
        credit.credit_note_number,
        credit.credit_note_status,
        credit.amount::text AS amount,
        credit.currency_code,
        credit.reason,
        credit.requested_by_user_id,
        credit.requested_at::text AS requested_at,
        credit.reviewed_by_user_id,
        credit.reviewed_at::text AS reviewed_at,
        credit.review_note,
        invoice.invoice_number,
        invoice.invoice_status::text AS invoice_status,
        invoice.total_amount::text AS invoice_total_amount,
        invoice.amount_paid::text AS invoice_amount_paid,
        invoice.balance_due::text AS invoice_balance_due,
        COALESCE(student.student_code, student.student_number) AS student_code,
        student.first_name AS student_first_name,
        student.last_name AS student_last_name,
        requester.first_name AS requester_first_name,
        requester.last_name AS requester_last_name,
        requester.email_original AS requester_email,
        reviewer.first_name AS reviewer_first_name,
        reviewer.last_name AS reviewer_last_name
      FROM finance_invoice_credit_notes credit
      JOIN invoices invoice
        ON invoice.id = credit.invoice_id
       AND invoice.deleted_at IS NULL
      JOIN students student
        ON student.id = credit.student_id
       AND student.deleted_at IS NULL
      JOIN users requester
        ON requester.id = credit.requested_by_user_id
       AND requester.deleted_at IS NULL
      LEFT JOIN users reviewer
        ON reviewer.id = credit.reviewed_by_user_id
       AND reviewer.deleted_at IS NULL
    `;
  }

  private mapPerson(input: {
    firstName: string | null;
    lastName: string | null;
    email?: string;
  }) {
    return {
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.email ? { email: input.email } : {}),
    };
  }

  private mapPaymentCorrection(row: PaymentCorrectionRow) {
    return {
      id: row.id,
      kind: 'PAYMENT_CORRECTION' as const,
      schoolId: row.school_id,
      paymentId: row.payment_id,
      paymentNumber: row.payment_number,
      paymentMethod: row.payment_method,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      student: {
        id: row.student_id,
        code: row.student_code,
        firstName: row.student_first_name,
        lastName: row.student_last_name,
      },
      correctionType: row.correction_type,
      status: row.correction_status,
      amount: Number(row.amount),
      currencyCode: row.currency_code,
      reason: row.reason,
      requestedByUserId: row.requested_by_user_id,
      requestedBy: this.mapPerson({
        firstName: row.requester_first_name,
        lastName: row.requester_last_name,
        email: row.requester_email,
      }),
      requestedAt: row.requested_at,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewedBy: row.reviewed_by_user_id
        ? this.mapPerson({
            firstName: row.reviewer_first_name,
            lastName: row.reviewer_last_name,
          })
        : null,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      processedByUserId: row.processed_by_user_id,
      processedBy: row.processed_by_user_id
        ? this.mapPerson({
            firstName: row.processor_first_name,
            lastName: row.processor_last_name,
          })
        : null,
      processedAt: row.processed_at,
      refundMethod: row.refund_method,
      refundReference: row.refund_reference,
      cashierSessionId: row.cashier_session_id,
    };
  }

  private mapCreditNote(row: CreditNoteRow) {
    return {
      id: row.id,
      kind: 'CREDIT_NOTE' as const,
      schoolId: row.school_id,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      student: {
        id: row.student_id,
        code: row.student_code,
        firstName: row.student_first_name,
        lastName: row.student_last_name,
      },
      creditNoteNumber: row.credit_note_number,
      status: row.credit_note_status,
      amount: Number(row.amount),
      currencyCode: row.currency_code,
      reason: row.reason,
      requestedByUserId: row.requested_by_user_id,
      requestedBy: this.mapPerson({
        firstName: row.requester_first_name,
        lastName: row.requester_last_name,
        email: row.requester_email,
      }),
      requestedAt: row.requested_at,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewedBy: row.reviewed_by_user_id
        ? this.mapPerson({
            firstName: row.reviewer_first_name,
            lastName: row.reviewer_last_name,
          })
        : null,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      invoice: {
        status: row.invoice_status,
        totalAmount: Number(row.invoice_total_amount),
        amountPaid: Number(row.invoice_amount_paid),
        balanceDue: Number(row.invoice_balance_due),
      },
    };
  }

  private async loadPaymentCorrectionTx(
    client: PoolClient,
    correctionId: string,
    schoolId: string,
    forUpdate = false,
  ) {
    const result = await client.query<PaymentCorrectionRow>(
      `
      ${this.paymentCorrectionSelect()}
      WHERE correction.id = $1
        AND correction.school_id = $2
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE OF correction' : ''}
      `,
      [correctionId, schoolId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(
        'Payment correction not found for this school.',
      );
    }
    return row;
  }

  private async loadCreditNoteTx(
    client: PoolClient,
    creditNoteId: string,
    schoolId: string,
    forUpdate = false,
  ) {
    const result = await client.query<CreditNoteRow>(
      `
      ${this.creditNoteSelect()}
      WHERE credit.id = $1
        AND credit.school_id = $2
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE OF credit' : ''}
      `,
      [creditNoteId, schoolId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Credit note not found for this school.');
    }
    return row;
  }

  private async recalculateInvoiceTx(
    client: PoolClient,
    invoiceId: string,
    schoolId: string,
  ) {
    const result = await client.query<{
      id: string;
      invoice_status: string;
      total_amount: string;
      amount_paid: string;
      balance_due: string;
    }>(
      `
      WITH payment_total AS (
        SELECT
          COALESCE(SUM(payment.amount), 0) -
          COALESCE((
            SELECT SUM(correction.amount)
            FROM finance_payment_corrections correction
            WHERE correction.invoice_id = $1
              AND correction.school_id = $2
              AND correction.correction_status = 'COMPLETED'
          ), 0) AS amount_paid
        FROM payments payment
        WHERE payment.invoice_id = $1
          AND payment.school_id = $2
          AND payment.payment_status = 'CONFIRMED'
          AND payment.deleted_at IS NULL
      ),
      school_date AS (
        SELECT (
          CURRENT_TIMESTAMP AT TIME ZONE
          COALESCE(NULLIF(BTRIM(timezone), ''), 'America/Port-au-Prince')
        )::date AS business_date
        FROM schools
        WHERE id = $2
          AND deleted_at IS NULL
      )
      UPDATE invoices invoice
      SET
        amount_paid = GREATEST(payment_total.amount_paid, 0),
        balance_due = GREATEST(
          invoice.total_amount - GREATEST(payment_total.amount_paid, 0),
          0
        ),
        invoice_status = CASE
          WHEN invoice.invoice_status = 'VOID'
            THEN 'VOID'::invoice_status
          WHEN GREATEST(payment_total.amount_paid, 0) >= invoice.total_amount
            THEN 'PAID'::invoice_status
          WHEN GREATEST(payment_total.amount_paid, 0) > 0
            THEN 'PARTIALLY_PAID'::invoice_status
          WHEN invoice.invoice_status = 'DRAFT'
            THEN 'DRAFT'::invoice_status
          WHEN invoice.due_date IS NOT NULL
            AND invoice.due_date < school_date.business_date
            THEN 'OVERDUE'::invoice_status
          ELSE 'ISSUED'::invoice_status
        END,
        updated_at = NOW()
      FROM payment_total, school_date
      WHERE invoice.id = $1
        AND invoice.school_id = $2
        AND invoice.deleted_at IS NULL
      RETURNING
        invoice.id,
        invoice.invoice_status::text AS invoice_status,
        invoice.total_amount::text AS total_amount,
        invoice.amount_paid::text AS amount_paid,
        invoice.balance_due::text AS balance_due
      `,
      [invoiceId, schoolId],
    );
    const invoice = result.rows[0];
    if (!invoice) {
      throw new NotFoundException('Invoice not found for this school.');
    }
    return {
      id: invoice.id,
      invoiceStatus: invoice.invoice_status,
      totalAmount: Number(invoice.total_amount),
      amountPaid: Number(invoice.amount_paid),
      balanceDue: Number(invoice.balance_due),
    };
  }

  async listCorrections(schoolId: string, status?: string) {
    const [paymentResult, creditResult] = await Promise.all([
      this.db.query<PaymentCorrectionRow>(
        `
        ${this.paymentCorrectionSelect()}
        WHERE correction.school_id = $1
          AND ($2::text IS NULL OR correction.correction_status = $2)
        ORDER BY correction.requested_at DESC
        LIMIT 100
        `,
        [schoolId, status ?? null],
      ),
      this.db.query<CreditNoteRow>(
        `
        ${this.creditNoteSelect()}
        WHERE credit.school_id = $1
          AND ($2::text IS NULL OR credit.credit_note_status = $2)
        ORDER BY credit.requested_at DESC
        LIMIT 100
        `,
        [schoolId, status ?? null],
      ),
    ]);
    return {
      paymentCorrections: paymentResult.rows.map((row) =>
        this.mapPaymentCorrection(row),
      ),
      creditNotes: creditResult.rows.map((row) => this.mapCreditNote(row)),
    };
  }

  async requestPaymentCorrection(
    paymentId: string,
    dto: RequestPaymentCorrectionDto,
    actorUserId: string,
    platformRole: PlatformRole,
    rawIdempotencyKey: string | undefined,
  ) {
    const idempotencyKey = this.idempotencyKey(rawIdempotencyKey);
    const requestHash = this.requestHash({
      paymentId,
      schoolId: dto.schoolId,
      correctionType: dto.correctionType,
      reason: dto.reason.trim(),
    });
    return this.db.withTransaction(async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`payment-correction:${dto.schoolId}:${idempotencyKey}`],
      );
      const replay = await client.query<{
        id: string;
        request_hash: string;
      }>(
        `
        SELECT id, request_hash
        FROM finance_payment_corrections
        WHERE school_id = $1
          AND idempotency_key = $2
        LIMIT 1
        `,
        [dto.schoolId, idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].request_hash !== requestHash) {
          throw new ConflictException(
            'The Idempotency-Key was already used for a different correction request.',
          );
        }
        return this.mapPaymentCorrection(
          await this.loadPaymentCorrectionTx(
            client,
            replay.rows[0].id,
            dto.schoolId,
          ),
        );
      }

      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`payment-correction-target:${dto.schoolId}:${paymentId}`],
      );
      const paymentResult = await client.query<{
        id: string;
        invoice_id: string | null;
        student_id: string;
        payment_number: string | null;
        payment_status: string;
        amount: string;
        currency_code: string;
        payment_method: string | null;
        payment_reference: string | null;
        payment_date: string;
        invoice_number: string | null;
        invoice_status: string | null;
      }>(
        `
        SELECT
          payment.id,
          payment.invoice_id,
          payment.student_id,
          COALESCE(payment.payment_number, payment.receipt_number) AS payment_number,
          payment.payment_status::text AS payment_status,
          payment.amount::text AS amount,
          payment.currency_code,
          COALESCE(payment.payment_method::text, payment.method) AS payment_method,
          COALESCE(
            payment.payment_reference,
            payment.reference,
            payment.reference_no
          ) AS payment_reference,
          payment.payment_date::text AS payment_date,
          invoice.invoice_number,
          invoice.invoice_status::text AS invoice_status
        FROM payments payment
        LEFT JOIN invoices invoice
          ON invoice.id = payment.invoice_id
         AND invoice.deleted_at IS NULL
        WHERE payment.id = $1
          AND payment.school_id = $2
          AND payment.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE OF payment
        `,
        [paymentId, dto.schoolId],
      );
      const payment = paymentResult.rows[0];
      if (!payment || !payment.invoice_id || !payment.invoice_status) {
        throw new NotFoundException(
          'Payment or its invoice was not found for this school.',
        );
      }
      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        payment.payment_date,
        'Payment correction request',
      );
      if (payment.payment_status !== 'CONFIRMED') {
        throw new ConflictException(
          'Only a confirmed payment can be corrected.',
        );
      }
      if (payment.invoice_status === 'VOID') {
        throw new ConflictException(
          'A payment on a void invoice cannot be corrected.',
        );
      }
      const activeCorrection = await client.query<{ id: string }>(
        `
        SELECT id
        FROM finance_payment_corrections
        WHERE payment_id = $1
          AND correction_status IN (
            'PENDING_REVIEW',
            'APPROVED',
            'COMPLETED'
          )
        LIMIT 1
        `,
        [payment.id],
      );
      if (activeCorrection.rows[0]) {
        throw new ConflictException(
          'This payment already has an active or completed correction.',
        );
      }
      const inserted = await client.query<{ id: string }>(
        `
        INSERT INTO finance_payment_corrections (
          school_id,
          payment_id,
          invoice_id,
          student_id,
          correction_type,
          amount,
          currency_code,
          reason,
          requested_by_user_id,
          idempotency_key,
          request_hash,
          original_payment_snapshot
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
        )
        RETURNING id
        `,
        [
          dto.schoolId,
          payment.id,
          payment.invoice_id,
          payment.student_id,
          dto.correctionType,
          Number(payment.amount),
          payment.currency_code,
          dto.reason.trim(),
          actorUserId,
          idempotencyKey,
          requestHash,
          JSON.stringify({
            paymentNumber: payment.payment_number,
            paymentStatus: payment.payment_status,
            paymentDate: payment.payment_date,
            amount: Number(payment.amount),
            currencyCode: payment.currency_code,
            paymentMethod: payment.payment_method,
            paymentReference: payment.payment_reference,
            invoiceId: payment.invoice_id,
            invoiceNumber: payment.invoice_number,
          }),
        ],
      );
      const correctionId = inserted.rows[0].id;
      await this.recordEventTx(client, {
        schoolId: dto.schoolId,
        subjectType: 'PAYMENT_CORRECTION',
        subjectId: correctionId,
        eventType: 'REQUESTED',
        actorUserId,
        payload: {
          paymentId,
          correctionType: dto.correctionType,
          amount: Number(payment.amount),
          currencyCode: payment.currency_code,
        },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYMENT_CORRECTION_REQUESTED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `${dto.correctionType === 'REFUND' ? 'Refund' : 'Payment reversal'} requested for ${payment.payment_number ?? payment.id}.`,
        payload: {
          correctionId,
          paymentId,
          invoiceId: payment.invoice_id,
          correctionType: dto.correctionType,
          amount: Number(payment.amount),
          currencyCode: payment.currency_code,
        },
      });
      return this.mapPaymentCorrection(
        await this.loadPaymentCorrectionTx(
          client,
          correctionId,
          dto.schoolId,
        ),
      );
    });
  }

  async approvePaymentCorrection(
    correctionId: string,
    dto: ReviewFinanceCorrectionDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    return this.db.withTransaction(async (client) => {
      const row = await this.loadPaymentCorrectionTx(
        client,
        correctionId,
        dto.schoolId,
        true,
      );
      if (row.requested_by_user_id === actorUserId) {
        throw new ForbiddenException(
          'The requester cannot approve their own correction.',
        );
      }
      if (row.correction_status !== 'PENDING_REVIEW') {
        throw new ConflictException(
          'Only a pending correction can be approved.',
        );
      }
      await client.query(
        `
        UPDATE finance_payment_corrections
        SET
          correction_status = 'APPROVED',
          reviewed_by_user_id = $3,
          reviewed_at = NOW(),
          review_note = $4,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [
          correctionId,
          dto.schoolId,
          actorUserId,
          dto.reviewNote?.trim() || null,
        ],
      );
      await this.recordEventTx(client, {
        schoolId: dto.schoolId,
        subjectType: 'PAYMENT_CORRECTION',
        subjectId: correctionId,
        eventType: 'APPROVED',
        actorUserId,
        payload: { reviewNote: dto.reviewNote?.trim() || null },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYMENT_CORRECTION_APPROVED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Payment correction approved for ${row.payment_number ?? row.payment_id}.`,
        payload: {
          correctionId,
          paymentId: row.payment_id,
          correctionType: row.correction_type,
        },
      });
      return this.mapPaymentCorrection(
        await this.loadPaymentCorrectionTx(
          client,
          correctionId,
          dto.schoolId,
        ),
      );
    });
  }

  async rejectPaymentCorrection(
    correctionId: string,
    dto: ReviewFinanceCorrectionDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const reviewNote = dto.reviewNote?.trim() ?? '';
    if (reviewNote.length < 10) {
      throw new BadRequestException(
        'A rejection reason of at least 10 characters is required.',
      );
    }
    return this.db.withTransaction(async (client) => {
      const row = await this.loadPaymentCorrectionTx(
        client,
        correctionId,
        dto.schoolId,
        true,
      );
      if (row.requested_by_user_id === actorUserId) {
        throw new ForbiddenException(
          'The requester cannot review their own correction.',
        );
      }
      if (row.correction_status !== 'PENDING_REVIEW') {
        throw new ConflictException(
          'Only a pending correction can be rejected.',
        );
      }
      await client.query(
        `
        UPDATE finance_payment_corrections
        SET
          correction_status = 'REJECTED',
          reviewed_by_user_id = $3,
          reviewed_at = NOW(),
          review_note = $4,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [correctionId, dto.schoolId, actorUserId, reviewNote],
      );
      await this.recordEventTx(client, {
        schoolId: dto.schoolId,
        subjectType: 'PAYMENT_CORRECTION',
        subjectId: correctionId,
        eventType: 'REJECTED',
        actorUserId,
        payload: { reviewNote },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'PAYMENT_CORRECTION_REJECTED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Payment correction rejected for ${row.payment_number ?? row.payment_id}.`,
        payload: {
          correctionId,
          paymentId: row.payment_id,
          correctionType: row.correction_type,
          reviewNote,
        },
      });
      return this.mapPaymentCorrection(
        await this.loadPaymentCorrectionTx(
          client,
          correctionId,
          dto.schoolId,
        ),
      );
    });
  }

  async processPaymentCorrection(
    correctionId: string,
    dto: ProcessPaymentCorrectionDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    return this.db.withTransaction(async (client) => {
      const row = await this.loadPaymentCorrectionTx(
        client,
        correctionId,
        dto.schoolId,
        true,
      );
      if (row.correction_status !== 'APPROVED') {
        throw new ConflictException(
          'Only an approved correction can be processed.',
        );
      }
      const paymentDateResult = await client.query<{ payment_date: string }>(
        `
        SELECT payment_date::text AS payment_date
        FROM payments
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [row.payment_id, dto.schoolId],
      );
      const paymentDate = paymentDateResult.rows[0]?.payment_date;
      if (!paymentDate) {
        throw new NotFoundException('Original payment not found.');
      }
      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        paymentDate,
        'Payment correction processing',
      );
      let refundMethod: string | null = null;
      let refundReference: string | null = null;
      let cashierSessionId: string | null = null;
      if (row.correction_type === 'REFUND') {
        refundMethod = dto.refundMethod ?? '';
        refundReference = dto.refundReference?.trim() || null;
        if (!refundMethod) {
          throw new BadRequestException('A refund method is required.');
        }
        if (refundMethod === 'CASH') {
          if (!dto.cashierSessionId) {
            throw new BadRequestException(
              'An open cashier session is required for a cash refund.',
            );
          }
          await this.cashierWorkflowService.assertOpenSessionTx(client, {
            sessionId: dto.cashierSessionId,
            schoolId: dto.schoolId,
            cashierUserId: actorUserId,
            currencyCode: row.currency_code,
          });
          cashierSessionId = dto.cashierSessionId;
        } else if (!refundReference || refundReference.length < 3) {
          throw new BadRequestException(
            'A refund reference is required for a non-cash refund.',
          );
        }
      } else if (
        dto.refundMethod ||
        dto.refundReference ||
        dto.cashierSessionId
      ) {
        throw new BadRequestException(
          'Refund settlement fields cannot be used for a reversal.',
        );
      }

      await client.query(
        `
        UPDATE finance_payment_corrections
        SET
          correction_status = 'COMPLETED',
          processed_by_user_id = $3,
          processed_at = NOW(),
          refund_method = $4,
          refund_reference = $5,
          cashier_session_id = $6,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [
          correctionId,
          dto.schoolId,
          actorUserId,
          refundMethod,
          refundReference,
          cashierSessionId,
        ],
      );
      const invoice = await this.recalculateInvoiceTx(
        client,
        row.invoice_id,
        dto.schoolId,
      );
      await this.recordEventTx(client, {
        schoolId: dto.schoolId,
        subjectType: 'PAYMENT_CORRECTION',
        subjectId: correctionId,
        eventType: 'COMPLETED',
        actorUserId,
        payload: {
          correctionType: row.correction_type,
          refundMethod,
          refundReference,
          cashierSessionId,
          invoice,
        },
      });
      await this.platformActivityService.recordTx(client, {
        eventType:
          row.correction_type === 'REFUND'
            ? 'PAYMENT_REFUND_COMPLETED'
            : 'PAYMENT_REVERSAL_COMPLETED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `${row.correction_type === 'REFUND' ? 'Refund completed' : 'Payment reversed'} for ${row.payment_number ?? row.payment_id}.`,
        payload: {
          correctionId,
          paymentId: row.payment_id,
          invoiceId: row.invoice_id,
          amount: Number(row.amount),
          currencyCode: row.currency_code,
          refundMethod,
          refundReference,
          cashierSessionId,
          invoice,
        },
      });
      return {
        correction: this.mapPaymentCorrection(
          await this.loadPaymentCorrectionTx(
            client,
            correctionId,
            dto.schoolId,
          ),
        ),
        invoice,
      };
    });
  }

  async requestCreditNote(
    invoiceId: string,
    dto: RequestCreditNoteDto,
    actorUserId: string,
    platformRole: PlatformRole,
    rawIdempotencyKey: string | undefined,
  ) {
    const idempotencyKey = this.idempotencyKey(rawIdempotencyKey);
    const amount = Number(Number(dto.amount).toFixed(2));
    const requestHash = this.requestHash({
      invoiceId,
      schoolId: dto.schoolId,
      amount,
      reason: dto.reason.trim(),
    });
    return this.db.withTransaction(async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`credit-note:${dto.schoolId}:${idempotencyKey}`],
      );
      const replay = await client.query<{
        id: string;
        request_hash: string;
      }>(
        `
        SELECT id, request_hash
        FROM finance_invoice_credit_notes
        WHERE school_id = $1
          AND idempotency_key = $2
        LIMIT 1
        `,
        [dto.schoolId, idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].request_hash !== requestHash) {
          throw new ConflictException(
            'The Idempotency-Key was already used for a different credit note request.',
          );
        }
        return this.mapCreditNote(
          await this.loadCreditNoteTx(
            client,
            replay.rows[0].id,
            dto.schoolId,
          ),
        );
      }
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`credit-note-target:${dto.schoolId}:${invoiceId}`],
      );
      const invoiceResult = await client.query<{
        id: string;
        student_id: string | null;
        invoice_number: string | null;
        invoice_status: string;
        total_amount: string;
        amount_paid: string;
        balance_due: string;
        currency_code: string;
        issue_date: string;
      }>(
        `
        SELECT
          id,
          student_id,
          invoice_number,
          invoice_status::text AS invoice_status,
          total_amount::text AS total_amount,
          amount_paid::text AS amount_paid,
          balance_due::text AS balance_due,
          currency_code,
          issue_date::text AS issue_date
        FROM invoices
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [invoiceId, dto.schoolId],
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice || !invoice.student_id) {
        throw new NotFoundException('Invoice not found for this school.');
      }
      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        invoice.issue_date,
        'Credit note request',
      );
      if (['DRAFT', 'VOID'].includes(invoice.invoice_status)) {
        throw new ConflictException(
          'A draft or void invoice cannot receive a credit note.',
        );
      }
      if (amount > Number(invoice.balance_due)) {
        throw new BadRequestException(
          'A credit note cannot exceed the current invoice balance.',
        );
      }
      const pendingCreditNote = await client.query<{ id: string }>(
        `
        SELECT id
        FROM finance_invoice_credit_notes
        WHERE invoice_id = $1
          AND credit_note_status = 'PENDING_REVIEW'
        LIMIT 1
        `,
        [invoice.id],
      );
      if (pendingCreditNote.rows[0]) {
        throw new ConflictException(
          'This invoice already has a credit note awaiting review.',
        );
      }
      const numberResult = await client.query<{
        credit_note_number: string;
      }>(
        `SELECT next_finance_credit_note_number($1) AS credit_note_number`,
        [dto.schoolId],
      );
      const inserted = await client.query<{ id: string }>(
        `
        INSERT INTO finance_invoice_credit_notes (
          school_id,
          invoice_id,
          student_id,
          credit_note_number,
          amount,
          currency_code,
          reason,
          requested_by_user_id,
          idempotency_key,
          request_hash,
          original_invoice_snapshot
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb
        )
        RETURNING id
        `,
        [
          dto.schoolId,
          invoice.id,
          invoice.student_id,
          numberResult.rows[0].credit_note_number,
          amount,
          invoice.currency_code,
          dto.reason.trim(),
          actorUserId,
          idempotencyKey,
          requestHash,
          JSON.stringify({
            invoiceNumber: invoice.invoice_number,
            invoiceStatus: invoice.invoice_status,
            totalAmount: Number(invoice.total_amount),
            amountPaid: Number(invoice.amount_paid),
            balanceDue: Number(invoice.balance_due),
            currencyCode: invoice.currency_code,
          }),
        ],
      );
      const creditNoteId = inserted.rows[0].id;
      await this.recordEventTx(client, {
        schoolId: dto.schoolId,
        subjectType: 'CREDIT_NOTE',
        subjectId: creditNoteId,
        eventType: 'REQUESTED',
        actorUserId,
        payload: {
          invoiceId,
          amount,
          currencyCode: invoice.currency_code,
          creditNoteNumber: numberResult.rows[0].credit_note_number,
        },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'INVOICE_CREDIT_NOTE_REQUESTED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Credit note ${numberResult.rows[0].credit_note_number} requested for invoice ${invoice.invoice_number ?? invoice.id}.`,
        payload: {
          creditNoteId,
          creditNoteNumber: numberResult.rows[0].credit_note_number,
          invoiceId,
          amount,
          currencyCode: invoice.currency_code,
        },
      });
      return this.mapCreditNote(
        await this.loadCreditNoteTx(client, creditNoteId, dto.schoolId),
      );
    });
  }

  async approveCreditNote(
    creditNoteId: string,
    dto: ReviewFinanceCorrectionDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    return this.db.withTransaction(async (client) => {
      const row = await this.loadCreditNoteTx(
        client,
        creditNoteId,
        dto.schoolId,
        true,
      );
      if (row.requested_by_user_id === actorUserId) {
        throw new ForbiddenException(
          'The requester cannot approve their own credit note.',
        );
      }
      if (row.credit_note_status !== 'PENDING_REVIEW') {
        throw new ConflictException(
          'Only a pending credit note can be approved.',
        );
      }
      const invoiceResult = await client.query<{
        id: string;
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
        [row.invoice_id, dto.schoolId],
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice) {
        throw new NotFoundException('Invoice not found for this school.');
      }
      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        invoice.issue_date,
        'Credit note application',
      );
      const amount = Number(row.amount);
      const balanceDue = Number(invoice.balance_due);
      if (
        ['DRAFT', 'VOID'].includes(invoice.invoice_status) ||
        amount > balanceDue
      ) {
        throw new ConflictException(
          'The invoice changed and can no longer receive this credit note.',
        );
      }
      const updatedInvoice = await client.query<{
        id: string;
        invoice_status: string;
        total_amount: string;
        amount_paid: string;
        balance_due: string;
      }>(
        `
        WITH school_date AS (
          SELECT (
            CURRENT_TIMESTAMP AT TIME ZONE
            COALESCE(NULLIF(BTRIM(timezone), ''), 'America/Port-au-Prince')
          )::date AS business_date
          FROM schools
          WHERE id = $2
            AND deleted_at IS NULL
        )
        UPDATE invoices invoice
        SET
          discount_amount = invoice.discount_amount + $3,
          total_amount = invoice.total_amount - $3,
          balance_due = invoice.balance_due - $3,
          invoice_status = CASE
            WHEN invoice.amount_paid >= invoice.total_amount - $3
              THEN 'PAID'::invoice_status
            WHEN invoice.amount_paid > 0
              THEN 'PARTIALLY_PAID'::invoice_status
            WHEN invoice.due_date IS NOT NULL
              AND invoice.due_date < school_date.business_date
              THEN 'OVERDUE'::invoice_status
            ELSE 'ISSUED'::invoice_status
          END,
          updated_at = NOW()
        FROM school_date
        WHERE invoice.id = $1
          AND invoice.school_id = $2
          AND invoice.deleted_at IS NULL
        RETURNING
          invoice.id,
          invoice.invoice_status::text AS invoice_status,
          invoice.total_amount::text AS total_amount,
          invoice.amount_paid::text AS amount_paid,
          invoice.balance_due::text AS balance_due
        `,
        [row.invoice_id, dto.schoolId, amount],
      );
      await client.query(
        `
        UPDATE finance_invoice_credit_notes
        SET
          credit_note_status = 'APPLIED',
          reviewed_by_user_id = $3,
          reviewed_at = NOW(),
          review_note = $4,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [
          creditNoteId,
          dto.schoolId,
          actorUserId,
          dto.reviewNote?.trim() || null,
        ],
      );
      const invoiceAfter = updatedInvoice.rows[0];
      await this.recordEventTx(client, {
        schoolId: dto.schoolId,
        subjectType: 'CREDIT_NOTE',
        subjectId: creditNoteId,
        eventType: 'APPROVED',
        actorUserId,
        payload: {
          creditNoteNumber: row.credit_note_number,
          invoiceId: row.invoice_id,
          amount,
          invoiceStatus: invoiceAfter.invoice_status,
          newTotalAmount: Number(invoiceAfter.total_amount),
          newBalanceDue: Number(invoiceAfter.balance_due),
        },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'INVOICE_CREDIT_NOTE_APPLIED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Credit note ${row.credit_note_number} applied.`,
        payload: {
          creditNoteId,
          creditNoteNumber: row.credit_note_number,
          invoiceId: row.invoice_id,
          amount,
          currencyCode: row.currency_code,
          newInvoiceStatus: invoiceAfter.invoice_status,
          newTotalAmount: Number(invoiceAfter.total_amount),
          newBalanceDue: Number(invoiceAfter.balance_due),
        },
      });
      return this.mapCreditNote(
        await this.loadCreditNoteTx(client, creditNoteId, dto.schoolId),
      );
    });
  }

  async rejectCreditNote(
    creditNoteId: string,
    dto: ReviewFinanceCorrectionDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const reviewNote = dto.reviewNote?.trim() ?? '';
    if (reviewNote.length < 10) {
      throw new BadRequestException(
        'A rejection reason of at least 10 characters is required.',
      );
    }
    return this.db.withTransaction(async (client) => {
      const row = await this.loadCreditNoteTx(
        client,
        creditNoteId,
        dto.schoolId,
        true,
      );
      if (row.requested_by_user_id === actorUserId) {
        throw new ForbiddenException(
          'The requester cannot review their own credit note.',
        );
      }
      if (row.credit_note_status !== 'PENDING_REVIEW') {
        throw new ConflictException(
          'Only a pending credit note can be rejected.',
        );
      }
      await client.query(
        `
        UPDATE finance_invoice_credit_notes
        SET
          credit_note_status = 'REJECTED',
          reviewed_by_user_id = $3,
          reviewed_at = NOW(),
          review_note = $4,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [creditNoteId, dto.schoolId, actorUserId, reviewNote],
      );
      await this.recordEventTx(client, {
        schoolId: dto.schoolId,
        subjectType: 'CREDIT_NOTE',
        subjectId: creditNoteId,
        eventType: 'REJECTED',
        actorUserId,
        payload: { reviewNote },
      });
      await this.platformActivityService.recordTx(client, {
        eventType: 'INVOICE_CREDIT_NOTE_REJECTED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Credit note ${row.credit_note_number} rejected.`,
        payload: {
          creditNoteId,
          creditNoteNumber: row.credit_note_number,
          invoiceId: row.invoice_id,
          reviewNote,
        },
      });
      return this.mapCreditNote(
        await this.loadCreditNoteTx(client, creditNoteId, dto.schoolId),
      );
    });
  }
}



