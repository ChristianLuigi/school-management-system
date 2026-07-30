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
import { CloseCashierSessionDto } from './dto/close-cashier-session.dto';
import { OpenCashierSessionDto } from './dto/open-cashier-session.dto';
import { RecordReceiptPrintDto } from './dto/record-receipt-print.dto';
import { ReopenCashierSessionDto } from './dto/reopen-cashier-session.dto';
import { assertFinanceDateOpen } from './security/finance-period-policy';

type CashierSessionRow = {
  id: string;
  school_id: string;
  cashier_user_id: string;
  business_date: string;
  currency_code: string;
  session_status: 'OPEN' | 'CLOSED';
  opening_cash_amount: string;
  expected_cash_amount: string | null;
  closing_cash_amount: string | null;
  variance_amount: string | null;
  opened_at: string;
  closed_at: string | null;
  reopened_count: string;
  last_reopened_at: string | null;
  last_reopen_reason: string | null;
  cashier_first_name: string | null;
  cashier_last_name: string | null;
  cashier_email: string;
};

@Injectable()
export class CashierWorkflowService {
  constructor(
    private readonly db: DbService,
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  private async getSchoolBusinessDate(
    schoolId: string,
    client?: PoolClient,
  ) {
    const executor = client ?? this.db;
    const result = await executor.query<{
      business_date: string;
    }>(
      `
      SELECT
        (
          CURRENT_TIMESTAMP AT TIME ZONE
          COALESCE(
            NULLIF(BTRIM(timezone), ''),
            'America/Port-au-Prince'
          )
        )::date::text AS business_date
      FROM schools
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId],
    );
    const businessDate = result.rows[0]?.business_date;
    if (!businessDate) {
      throw new NotFoundException('School not found.');
    }
    return businessDate;
  }

  private async loadSessionRow(
    sessionId: string,
    schoolId: string,
    client?: PoolClient,
    forUpdate = false,
  ) {
    const executor = client ?? this.db;
    const result = await executor.query<CashierSessionRow>(
      `
      SELECT
        session.id,
        session.school_id,
        session.cashier_user_id,
        session.business_date::text AS business_date,
        session.currency_code,
        session.session_status,
        session.opening_cash_amount::text AS opening_cash_amount,
        session.expected_cash_amount::text AS expected_cash_amount,
        session.closing_cash_amount::text AS closing_cash_amount,
        session.variance_amount::text AS variance_amount,
        session.opened_at::text AS opened_at,
        session.closed_at::text AS closed_at,
        session.reopened_count::text AS reopened_count,
        session.last_reopened_at::text AS last_reopened_at,
        session.last_reopen_reason,
        cashier.first_name AS cashier_first_name,
        cashier.last_name AS cashier_last_name,
        cashier.email_original AS cashier_email
      FROM finance_cashier_sessions session
      JOIN users cashier
        ON cashier.id = session.cashier_user_id
       AND cashier.deleted_at IS NULL
      WHERE session.id = $1
        AND session.school_id = $2
        AND session.deleted_at IS NULL
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE OF session' : ''}
      `,
      [sessionId, schoolId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(
        'Cashier session not found for this school.',
      );
    }
    return row;
  }

  private async collectionSummary(
    sessionId: string,
    client?: PoolClient,
  ) {
    const executor = client ?? this.db;
    const result = await executor.query<{
      payment_method: string;
      payment_count: string;
      collection_amount: string;
      refund_count: string;
      refund_amount: string;
      total_amount: string;
    }>(
      `
      SELECT
        activity.payment_method,
        SUM(activity.payment_count)::text AS payment_count,
        SUM(activity.collection_amount)::text AS collection_amount,
        SUM(activity.refund_count)::text AS refund_count,
        SUM(activity.refund_amount)::text AS refund_amount,
        (
          SUM(activity.collection_amount) -
          SUM(activity.refund_amount)
        )::text AS total_amount
      FROM (
        SELECT
          COALESCE(
            pay.payment_method::text,
            pay.method,
            'UNKNOWN'
          ) AS payment_method,
          1 AS payment_count,
          pay.amount AS collection_amount,
          0 AS refund_count,
          0::numeric AS refund_amount
        FROM payments pay
        WHERE pay.cashier_session_id = $1
          AND pay.payment_status = 'CONFIRMED'
          AND pay.deleted_at IS NULL

        UNION ALL

        SELECT
          correction.refund_method AS payment_method,
          0 AS payment_count,
          0::numeric AS collection_amount,
          1 AS refund_count,
          correction.amount AS refund_amount
        FROM finance_payment_corrections correction
        WHERE correction.cashier_session_id = $1
          AND correction.correction_type = 'REFUND'
          AND correction.correction_status = 'COMPLETED'
      ) activity
      GROUP BY activity.payment_method
      ORDER BY activity.payment_method
      `,
      [sessionId],
    );
    return result.rows.map((row) => ({
      paymentMethod: row.payment_method,
      paymentCount: Number(row.payment_count),
      collectionAmount: Number(row.collection_amount),
      refundCount: Number(row.refund_count),
      refundAmount: Number(row.refund_amount),
      totalAmount: Number(row.total_amount),
    }));
  }

  private async mapSession(
    row: CashierSessionRow,
    client?: PoolClient,
  ) {
    const collectionsByMethod = await this.collectionSummary(row.id, client);
    const cashCollections =
      collectionsByMethod.find((item) => item.paymentMethod === 'CASH')
        ?.totalAmount ?? 0;
    const liveExpectedCash = Number(
      (Number(row.opening_cash_amount) + cashCollections).toFixed(2),
    );

    return {
      id: row.id,
      schoolId: row.school_id,
      cashierUserId: row.cashier_user_id,
      businessDate: row.business_date,
      currencyCode: row.currency_code,
      status: row.session_status,
      openingCashAmount: Number(row.opening_cash_amount),
      expectedCashAmount:
        row.expected_cash_amount === null
          ? liveExpectedCash
          : Number(row.expected_cash_amount),
      closingCashAmount:
        row.closing_cash_amount === null
          ? null
          : Number(row.closing_cash_amount),
      varianceAmount:
        row.variance_amount === null ? null : Number(row.variance_amount),
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      reopenedCount: Number(row.reopened_count),
      lastReopenedAt: row.last_reopened_at,
      lastReopenReason: row.last_reopen_reason,
      cashier: {
        firstName: row.cashier_first_name,
        lastName: row.cashier_last_name,
        email: row.cashier_email,
      },
      collectionsByMethod,
      collectionCount: collectionsByMethod.reduce(
        (total, item) => total + item.paymentCount,
        0,
      ),
      refundCount: collectionsByMethod.reduce(
        (total, item) => total + item.refundCount,
        0,
      ),
      grossCollectionTotal: Number(
        collectionsByMethod
          .reduce((total, item) => total + item.collectionAmount, 0)
          .toFixed(2),
      ),
      refundTotal: Number(
        collectionsByMethod
          .reduce((total, item) => total + item.refundAmount, 0)
          .toFixed(2),
      ),
      collectionTotal: Number(
        collectionsByMethod
          .reduce((total, item) => total + item.totalAmount, 0)
          .toFixed(2),
      ),
    };
  }

  private assertSessionAccess(
    row: CashierSessionRow,
    actorUserId: string,
    canSupervise: boolean,
  ) {
    if (row.cashier_user_id !== actorUserId && !canSupervise) {
      throw new ForbiddenException(
        'You cannot access another cashier’s session.',
      );
    }
  }

  async getCurrentSession(
    schoolId: string,
    currencyCode: string | undefined,
    actorUserId: string,
    canSupervise: boolean,
  ) {
    const businessDate = await this.getSchoolBusinessDate(schoolId);
    if (!currencyCode) {
      return {
        businessDate,
        canSupervise,
        session: null,
      };
    }
    const normalizedCurrency = currencyCode.trim().toUpperCase();
    const result = await this.db.query<CashierSessionRow>(
      `
      SELECT
        session.id,
        session.school_id,
        session.cashier_user_id,
        session.business_date::text AS business_date,
        session.currency_code,
        session.session_status,
        session.opening_cash_amount::text AS opening_cash_amount,
        session.expected_cash_amount::text AS expected_cash_amount,
        session.closing_cash_amount::text AS closing_cash_amount,
        session.variance_amount::text AS variance_amount,
        session.opened_at::text AS opened_at,
        session.closed_at::text AS closed_at,
        session.reopened_count::text AS reopened_count,
        session.last_reopened_at::text AS last_reopened_at,
        session.last_reopen_reason,
        cashier.first_name AS cashier_first_name,
        cashier.last_name AS cashier_last_name,
        cashier.email_original AS cashier_email
      FROM finance_cashier_sessions session
      JOIN users cashier
        ON cashier.id = session.cashier_user_id
       AND cashier.deleted_at IS NULL
      WHERE session.school_id = $1
        AND session.cashier_user_id = $2
        AND session.business_date = $3::date
        AND session.currency_code = $4
        AND session.deleted_at IS NULL
      LIMIT 1
      `,
      [schoolId, actorUserId, businessDate, normalizedCurrency],
    );
    const row = result.rows[0];
    return {
      businessDate,
      canSupervise,
      session: row ? await this.mapSession(row) : null,
    };
  }

  async listSessions(
    schoolId: string,
    actorUserId: string,
    canSupervise: boolean,
    requestedBusinessDate?: string,
  ) {
    const businessDate =
      requestedBusinessDate ?? (await this.getSchoolBusinessDate(schoolId));
    const result = await this.db.query<CashierSessionRow>(
      `
      SELECT
        session.id,
        session.school_id,
        session.cashier_user_id,
        session.business_date::text AS business_date,
        session.currency_code,
        session.session_status,
        session.opening_cash_amount::text AS opening_cash_amount,
        session.expected_cash_amount::text AS expected_cash_amount,
        session.closing_cash_amount::text AS closing_cash_amount,
        session.variance_amount::text AS variance_amount,
        session.opened_at::text AS opened_at,
        session.closed_at::text AS closed_at,
        session.reopened_count::text AS reopened_count,
        session.last_reopened_at::text AS last_reopened_at,
        session.last_reopen_reason,
        cashier.first_name AS cashier_first_name,
        cashier.last_name AS cashier_last_name,
        cashier.email_original AS cashier_email
      FROM finance_cashier_sessions session
      JOIN users cashier
        ON cashier.id = session.cashier_user_id
       AND cashier.deleted_at IS NULL
      WHERE session.school_id = $1
        AND session.business_date = $2::date
        AND session.deleted_at IS NULL
        AND ($4::boolean OR session.cashier_user_id = $3)
      ORDER BY
        session.currency_code,
        cashier.last_name,
        cashier.first_name,
        session.opened_at
      `,
      [schoolId, businessDate, actorUserId, canSupervise],
    );
    return {
      businessDate,
      canSupervise,
      sessions: await Promise.all(
        result.rows.map((row) => this.mapSession(row)),
      ),
    };
  }

  async openSession(
    dto: OpenCashierSessionDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    const currencyCode = dto.currencyCode.trim().toUpperCase();
    const openingCashAmount = Number(
      Number(dto.openingCashAmount).toFixed(2),
    );
    return this.db.withTransaction(async (client) => {
      const businessDate = await this.getSchoolBusinessDate(
        dto.schoolId,
        client,
      );
      if (dto.businessDate && dto.businessDate !== businessDate) {
        throw new BadRequestException(
          `Cashier sessions must use the school business date ${businessDate}.`,
        );
      }
      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        businessDate,
        'Cashier session opening',
      );
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [
          `cashier:${dto.schoolId}:${actorUserId}:${businessDate}:${currencyCode}`,
        ],
      );
      const existing = await client.query<CashierSessionRow>(
        `
        SELECT
          session.id,
          session.school_id,
          session.cashier_user_id,
          session.business_date::text AS business_date,
          session.currency_code,
          session.session_status,
          session.opening_cash_amount::text AS opening_cash_amount,
          session.expected_cash_amount::text AS expected_cash_amount,
          session.closing_cash_amount::text AS closing_cash_amount,
          session.variance_amount::text AS variance_amount,
          session.opened_at::text AS opened_at,
          session.closed_at::text AS closed_at,
          session.reopened_count::text AS reopened_count,
          session.last_reopened_at::text AS last_reopened_at,
          session.last_reopen_reason,
          cashier.first_name AS cashier_first_name,
          cashier.last_name AS cashier_last_name,
          cashier.email_original AS cashier_email
        FROM finance_cashier_sessions session
        JOIN users cashier ON cashier.id = session.cashier_user_id
        WHERE session.school_id = $1
          AND session.cashier_user_id = $2
          AND session.business_date = $3::date
          AND session.currency_code = $4
          AND session.deleted_at IS NULL
        LIMIT 1
        FOR UPDATE OF session
        `,
        [dto.schoolId, actorUserId, businessDate, currencyCode],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].session_status === 'CLOSED') {
          throw new ConflictException(
            'This cashier session is closed and requires supervisor reopening.',
          );
        }
        return this.mapSession(existing.rows[0], client);
      }

      const inserted = await client.query<{ id: string }>(
        `
        INSERT INTO finance_cashier_sessions (
          school_id,
          cashier_user_id,
          business_date,
          currency_code,
          opening_cash_amount
        )
        VALUES ($1, $2, $3::date, $4, $5)
        RETURNING id
        `,
        [
          dto.schoolId,
          actorUserId,
          businessDate,
          currencyCode,
          openingCashAmount,
        ],
      );
      const sessionId = inserted.rows[0].id;
      await client.query(
        `
        INSERT INTO finance_cashier_session_events (
          school_id,
          cashier_session_id,
          event_type,
          actor_user_id,
          reason,
          event_payload
        )
        VALUES ($1, $2, 'OPENED', $3, $4, $5::jsonb)
        `,
        [
          dto.schoolId,
          sessionId,
          actorUserId,
          dto.note?.trim() || null,
          JSON.stringify({
            businessDate,
            currencyCode,
            openingCashAmount,
          }),
        ],
      );
      await this.platformActivityService.recordTx(client, {
        eventType: 'CASHIER_SESSION_OPENED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Cashier session opened for ${currencyCode}.`,
        payload: {
          cashierSessionId: sessionId,
          businessDate,
          currencyCode,
          openingCashAmount,
        },
      });
      const row = await this.loadSessionRow(
        sessionId,
        dto.schoolId,
        client,
      );
      return this.mapSession(row, client);
    });
  }

  async closeSession(
    sessionId: string,
    dto: CloseCashierSessionDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
    canSupervise: boolean,
  ) {
    const closingCashAmount = Number(
      Number(dto.closingCashAmount).toFixed(2),
    );
    return this.db.withTransaction(async (client) => {
      const row = await this.loadSessionRow(
        sessionId,
        dto.schoolId,
        client,
        true,
      );
      this.assertSessionAccess(row, actorUserId, canSupervise);
      if (row.session_status !== 'OPEN') {
        throw new ConflictException('Cashier session is already closed.');
      }
      const collections = await this.collectionSummary(sessionId, client);
      const cashCollections =
        collections.find((item) => item.paymentMethod === 'CASH')
          ?.totalAmount ?? 0;
      const expectedCashAmount = Number(
        (Number(row.opening_cash_amount) + cashCollections).toFixed(2),
      );
      const varianceAmount = Number(
        (closingCashAmount - expectedCashAmount).toFixed(2),
      );
      await client.query(
        `
        UPDATE finance_cashier_sessions
        SET
          session_status = 'CLOSED',
          expected_cash_amount = $3,
          closing_cash_amount = $4,
          variance_amount = $5,
          closed_at = NOW(),
          closed_by_user_id = $6,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [
          sessionId,
          dto.schoolId,
          expectedCashAmount,
          closingCashAmount,
          varianceAmount,
          actorUserId,
        ],
      );
      const payload = {
        expectedCashAmount,
        closingCashAmount,
        varianceAmount,
        collectionsByMethod: collections,
      };
      await client.query(
        `
        INSERT INTO finance_cashier_session_events (
          school_id,
          cashier_session_id,
          event_type,
          actor_user_id,
          event_payload
        )
        VALUES ($1, $2, 'CLOSED', $3, $4::jsonb)
        `,
        [dto.schoolId, sessionId, actorUserId, JSON.stringify(payload)],
      );
      await this.platformActivityService.recordTx(client, {
        eventType: 'CASHIER_SESSION_CLOSED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Cashier session closed with variance ${varianceAmount.toFixed(2)} ${row.currency_code}.`,
        payload: {
          cashierSessionId: sessionId,
          cashierUserId: row.cashier_user_id,
          currencyCode: row.currency_code,
          ...payload,
        },
      });
      const updated = await this.loadSessionRow(
        sessionId,
        dto.schoolId,
        client,
      );
      return this.mapSession(updated, client);
    });
  }

  async reopenSession(
    sessionId: string,
    dto: ReopenCashierSessionDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
    canSupervise: boolean,
  ) {
    if (!canSupervise) {
      throw new ForbiddenException(
        'Supervisor permission is required to reopen a cashier session.',
      );
    }
    const reason = dto.reason.trim();
    return this.db.withTransaction(async (client) => {
      const row = await this.loadSessionRow(
        sessionId,
        dto.schoolId,
        client,
        true,
      );
      if (row.session_status !== 'CLOSED') {
        throw new ConflictException('Only a closed session can be reopened.');
      }
      await client.query(
        `
        UPDATE finance_cashier_sessions
        SET
          session_status = 'OPEN',
          expected_cash_amount = NULL,
          closing_cash_amount = NULL,
          variance_amount = NULL,
          closed_at = NULL,
          closed_by_user_id = NULL,
          reopened_count = reopened_count + 1,
          last_reopened_at = NOW(),
          last_reopened_by_user_id = $3,
          last_reopen_reason = $4,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [sessionId, dto.schoolId, actorUserId, reason],
      );
      await client.query(
        `
        INSERT INTO finance_cashier_session_events (
          school_id,
          cashier_session_id,
          event_type,
          actor_user_id,
          reason,
          event_payload
        )
        VALUES ($1, $2, 'REOPENED', $3, $4, $5::jsonb)
        `,
        [
          dto.schoolId,
          sessionId,
          actorUserId,
          reason,
          JSON.stringify({
            previousClosingCashAmount:
              row.closing_cash_amount === null
                ? null
                : Number(row.closing_cash_amount),
            previousExpectedCashAmount:
              row.expected_cash_amount === null
                ? null
                : Number(row.expected_cash_amount),
            previousVarianceAmount:
              row.variance_amount === null
                ? null
                : Number(row.variance_amount),
          }),
        ],
      );
      await this.platformActivityService.recordTx(client, {
        eventType: 'CASHIER_SESSION_REOPENED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: 'Supervisor reopened a closed cashier session.',
        payload: {
          cashierSessionId: sessionId,
          cashierUserId: row.cashier_user_id,
          reason,
        },
      });
      const updated = await this.loadSessionRow(
        sessionId,
        dto.schoolId,
        client,
      );
      return this.mapSession(updated, client);
    });
  }

  async assertOpenSessionTx(
    client: PoolClient,
    input: {
      sessionId: string;
      schoolId: string;
      cashierUserId: string;
      currencyCode: string;
      paymentDate?: string;
    },
  ) {
    const row = await this.loadSessionRow(
      input.sessionId,
      input.schoolId,
      client,
      true,
    );
    if (
      row.cashier_user_id !== input.cashierUserId ||
      row.session_status !== 'OPEN' ||
      row.currency_code !== input.currencyCode ||
      (input.paymentDate !== undefined &&
        row.business_date !== input.paymentDate)
    ) {
      throw new ConflictException(
        'Payment must match the cashier’s open session, business date and currency.',
      );
    }
    return row;
  }

  async getReceiptPrintSummary(paymentId: string, schoolId: string) {
    const payment = await this.db.query(
      `
      SELECT id
      FROM payments
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [paymentId, schoolId],
    );
    if (!payment.rowCount) {
      throw new NotFoundException('Payment not found for this school.');
    }
    const result = await this.db.query<{
      print_count: string;
      last_printed_at: string | null;
    }>(
      `
      SELECT
        COUNT(*)::text AS print_count,
        MAX(created_at)::text AS last_printed_at
      FROM finance_receipt_print_events
      WHERE payment_id = $1
        AND school_id = $2
      `,
      [paymentId, schoolId],
    );
    return {
      printCount: Number(result.rows[0]?.print_count ?? 0),
      lastPrintedAt: result.rows[0]?.last_printed_at ?? null,
    };
  }

  async recordReceiptPrint(
    paymentId: string,
    dto: RecordReceiptPrintDto,
    actorUserId: string,
    platformRole: 'SUPER_ADMIN' | null,
  ) {
    return this.db.withTransaction(async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`receipt-print:${dto.schoolId}:${paymentId}`],
      );
      const payment = await client.query<{
        id: string;
        cashier_session_id: string | null;
        receipt_number: string | null;
      }>(
        `
        SELECT id, cashier_session_id, receipt_number
        FROM payments
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [paymentId, dto.schoolId],
      );
      const row = payment.rows[0];
      if (!row) {
        throw new NotFoundException('Payment not found for this school.');
      }
      const countResult = await client.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM finance_receipt_print_events
        WHERE payment_id = $1
          AND school_id = $2
        `,
        [paymentId, dto.schoolId],
      );
      const previousCount = Number(countResult.rows[0]?.count ?? 0);
      const printKind = previousCount === 0 ? 'INITIAL' : 'REPRINT';
      const reason = dto.reason?.trim() || null;
      if (printKind === 'REPRINT' && (!reason || reason.length < 5)) {
        throw new BadRequestException(
          'A reason of at least 5 characters is required to reprint a receipt.',
        );
      }
      await client.query(
        `
        INSERT INTO finance_receipt_print_events (
          school_id,
          payment_id,
          cashier_session_id,
          actor_user_id,
          print_kind,
          print_format,
          reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          dto.schoolId,
          paymentId,
          row.cashier_session_id,
          actorUserId,
          printKind,
          dto.printFormat,
          reason,
        ],
      );
      await this.platformActivityService.recordTx(client, {
        eventType:
          printKind === 'INITIAL'
            ? 'PAYMENT_RECEIPT_PRINTED'
            : 'PAYMENT_RECEIPT_REPRINTED',
        actorType:
          platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF',
        actorUserId,
        schoolId: dto.schoolId,
        summary: `${printKind === 'INITIAL' ? 'Receipt printed' : 'Receipt reprinted'} for payment ${row.receipt_number ?? paymentId}.`,
        payload: {
          paymentId,
          cashierSessionId: row.cashier_session_id,
          printKind,
          printFormat: dto.printFormat,
          reason,
        },
      });
      return {
        recorded: true,
        paymentId,
        printKind,
        printCount: previousCount + 1,
        printFormat: dto.printFormat,
      };
    });
  }
}


