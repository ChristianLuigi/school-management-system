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
import { CreateFinanceAccountingPeriodDto } from './dto/create-finance-accounting-period.dto';
import { CreateFinanceBankAccountDto } from './dto/create-finance-bank-account.dto';
import { CreateFinanceDepositDto } from './dto/create-finance-deposit.dto';
import { FinancePeriodActionDto } from './dto/finance-period-action.dto';
import { FinanceReconciliationQueryDto } from './dto/finance-reconciliation-query.dto';
import { ReviewFinanceDepositDto } from './dto/review-finance-deposit.dto';
import { UpdateFinanceBankAccountStatusDto } from './dto/update-finance-bank-account-status.dto';
import { assertFinanceDateOpen } from './security/finance-period-policy';

type PlatformRole = 'SUPER_ADMIN' | null;
type QueryClient = Pick<PoolClient, 'query'>;

type BankAccountRow = {
  id: string;
  school_id: string;
  account_code: string;
  display_name: string;
  currency_code: string;
  institution_name: string | null;
  account_reference_masked: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CashierSessionRow = {
  id: string;
  school_id: string;
  cashier_user_id: string;
  cashier_first_name: string | null;
  cashier_last_name: string | null;
  business_date: string;
  currency_code: string;
  closed_at: string;
  ledger_collection_amount: string;
};

type DepositRow = {
  id: string;
  school_id: string;
  bank_account_id: string;
  bank_account_code: string;
  bank_account_name: string;
  currency_code: string;
  deposit_date: string;
  expected_amount: string;
  deposited_amount: string;
  variance_amount: string;
  deposit_reference: string;
  evidence_note: string | null;
  reconciliation_status: 'PENDING_REVIEW' | 'RECONCILED' | 'REJECTED';
  requested_by_user_id: string;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requested_at: string;
  reviewed_by_user_id: string | null;
  reviewer_first_name: string | null;
  reviewer_last_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

type PeriodRow = {
  id: string;
  school_id: string;
  period_code: string;
  display_name: string;
  start_date: string;
  end_date: string;
  period_status: 'OPEN' | 'CLOSED';
  closed_at: string | null;
  close_reason: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
  reopen_count: number;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class FinanceReconciliationService {
  constructor(
    private readonly db: DbService,
    private readonly activity: PlatformActivityService,
  ) {}

  private actorType(platformRole: PlatformRole) {
    return platformRole === 'SUPER_ADMIN' ? 'SUPERADMIN' : 'SCHOOL_STAFF';
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

  private mapBankAccount(row: BankAccountRow) {
    return {
      id: row.id,
      schoolId: row.school_id,
      accountCode: row.account_code,
      displayName: row.display_name,
      currencyCode: row.currency_code,
      institutionName: row.institution_name,
      accountReferenceMasked: row.account_reference_masked,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapSession(row: CashierSessionRow) {
    return {
      id: row.id,
      schoolId: row.school_id,
      cashierUserId: row.cashier_user_id,
      cashierName:
        [row.cashier_first_name, row.cashier_last_name]
          .filter(Boolean)
          .join(' ') || 'Cashier',
      businessDate: row.business_date,
      currencyCode: row.currency_code,
      closedAt: row.closed_at,
      expectedCollectionAmount: Number(row.ledger_collection_amount),
    };
  }

  private mapDeposit(
    row: DepositRow,
    sessions: Array<{
      id: string;
      cashierSessionId: string;
      businessDate: string;
      cashierName: string;
      expectedCollectionAmount: number;
      releasedAt: string | null;
    }> = [],
  ) {
    return {
      id: row.id,
      schoolId: row.school_id,
      bankAccountId: row.bank_account_id,
      bankAccountCode: row.bank_account_code,
      bankAccountName: row.bank_account_name,
      currencyCode: row.currency_code,
      depositDate: row.deposit_date,
      expectedAmount: Number(row.expected_amount),
      depositedAmount: Number(row.deposited_amount),
      varianceAmount: Number(row.variance_amount),
      depositReference: row.deposit_reference,
      evidenceNote: row.evidence_note,
      status: row.reconciliation_status,
      requestedByUserId: row.requested_by_user_id,
      requesterName:
        [row.requester_first_name, row.requester_last_name]
          .filter(Boolean)
          .join(' ') || 'User',
      requestedAt: row.requested_at,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewerName:
        [row.reviewer_first_name, row.reviewer_last_name]
          .filter(Boolean)
          .join(' ') || null,
      reviewedAt: row.reviewed_at,
      reviewNote: row.review_note,
      sessions,
      createdAt: row.created_at,
    };
  }

  private mapPeriod(row: PeriodRow) {
    return {
      id: row.id,
      schoolId: row.school_id,
      periodCode: row.period_code,
      displayName: row.display_name,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.period_status,
      closedAt: row.closed_at,
      closeReason: row.close_reason,
      reopenedAt: row.reopened_at,
      reopenReason: row.reopen_reason,
      reopenCount: row.reopen_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async loadBankAccount(
    client: QueryClient,
    schoolId: string,
    bankAccountId: string,
    lock = false,
  ) {
    const result = await client.query<BankAccountRow>(
      `
      SELECT
        id,
        school_id,
        account_code,
        display_name,
        currency_code,
        institution_name,
        account_reference_masked,
        is_active,
        created_at,
        updated_at
      FROM finance_bank_accounts
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      ${lock ? 'FOR UPDATE' : ''}
      `,
      [bankAccountId, schoolId],
    );
    const account = result.rows[0];
    if (!account) {
      throw new NotFoundException('Finance bank account not found.');
    }
    return account;
  }

  private async loadDeposit(
    client: QueryClient,
    schoolId: string,
    depositId: string,
    lock = false,
  ) {
    const result = await client.query<DepositRow>(
      `
      SELECT
        deposit.id,
        deposit.school_id,
        deposit.bank_account_id,
        account.account_code AS bank_account_code,
        account.display_name AS bank_account_name,
        deposit.currency_code,
        deposit.deposit_date,
        deposit.expected_amount,
        deposit.deposited_amount,
        deposit.variance_amount,
        deposit.deposit_reference,
        deposit.evidence_note,
        deposit.reconciliation_status,
        deposit.requested_by_user_id,
        requester.first_name AS requester_first_name,
        requester.last_name AS requester_last_name,
        deposit.requested_at,
        deposit.reviewed_by_user_id,
        reviewer.first_name AS reviewer_first_name,
        reviewer.last_name AS reviewer_last_name,
        deposit.reviewed_at,
        deposit.review_note,
        deposit.created_at
      FROM finance_deposits deposit
      JOIN finance_bank_accounts account
        ON account.id = deposit.bank_account_id
       AND account.school_id = deposit.school_id
      JOIN users requester
        ON requester.id = deposit.requested_by_user_id
      LEFT JOIN users reviewer
        ON reviewer.id = deposit.reviewed_by_user_id
      WHERE deposit.id = $1
        AND deposit.school_id = $2
      LIMIT 1
      ${lock ? 'FOR UPDATE OF deposit' : ''}
      `,
      [depositId, schoolId],
    );
    const deposit = result.rows[0];
    if (!deposit) {
      throw new NotFoundException('Finance deposit not found.');
    }
    return deposit;
  }

  private async loadDepositSessions(
    client: QueryClient,
    depositId: string,
  ) {
    const result = await client.query<{
      id: string;
      cashier_session_id: string;
      business_date: string;
      cashier_first_name: string | null;
      cashier_last_name: string | null;
      expected_collection_amount: string;
      released_at: string | Date | null;
    }>(
      `
      SELECT
        link.id,
        link.cashier_session_id,
        session.business_date,
        cashier.first_name AS cashier_first_name,
        cashier.last_name AS cashier_last_name,
        link.expected_collection_amount,
        link.released_at
      FROM finance_deposit_cashier_sessions link
      JOIN finance_cashier_sessions session
        ON session.id = link.cashier_session_id
      JOIN users cashier
        ON cashier.id = session.cashier_user_id
      WHERE link.deposit_id = $1
      ORDER BY session.business_date, link.cashier_session_id
      `,
      [depositId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      cashierSessionId: row.cashier_session_id,
      businessDate: row.business_date,
      cashierName:
        [row.cashier_first_name, row.cashier_last_name]
          .filter(Boolean)
          .join(' ') || 'Cashier',
      expectedCollectionAmount: Number(row.expected_collection_amount),
      releasedAt:
        row.released_at instanceof Date
          ? row.released_at.toISOString()
          : row.released_at,
    }));
  }

  private async availableSessions(
    client: QueryClient,
    schoolId: string,
    sessionIds?: string[],
    lock = false,
  ) {
    const parameters: unknown[] = [schoolId];
    let sessionFilter = '';
    if (sessionIds) {
      parameters.push(sessionIds);
      sessionFilter = 'AND session.id = ANY($2::uuid[])';
    }
    const result = await client.query<CashierSessionRow>(
      `
      SELECT
        session.id,
        session.school_id,
        session.cashier_user_id,
        cashier.first_name AS cashier_first_name,
        cashier.last_name AS cashier_last_name,
        session.business_date,
        session.currency_code,
        session.closed_at,
        (
          COALESCE((
            SELECT SUM(payment.amount)
            FROM payments payment
            WHERE payment.cashier_session_id = session.id
              AND payment.payment_status = 'CONFIRMED'
              AND payment.payment_method = 'CASH'
              AND payment.deleted_at IS NULL
          ), 0)
          -
          COALESCE((
            SELECT SUM(correction.amount)
            FROM finance_payment_corrections correction
            WHERE correction.cashier_session_id = session.id
              AND correction.correction_type = 'REFUND'
              AND correction.correction_status = 'COMPLETED'
              AND correction.refund_method = 'CASH'
          ), 0)
        )::text AS ledger_collection_amount
      FROM finance_cashier_sessions session
      JOIN users cashier
        ON cashier.id = session.cashier_user_id
      WHERE session.school_id = $1
        AND session.session_status = 'CLOSED'
        AND session.deleted_at IS NULL
        ${sessionFilter}
        AND NOT EXISTS (
          SELECT 1
          FROM finance_deposit_cashier_sessions link
          WHERE link.cashier_session_id = session.id
            AND link.released_at IS NULL
        )
      ORDER BY session.business_date, session.id
      ${lock ? 'FOR UPDATE OF session' : ''}
      `,
      parameters,
    );
    return result.rows.filter(
      (row) => Number(row.ledger_collection_amount) > 0,
    );
  }

  async getContext(query: FinanceReconciliationQueryDto) {
    const [accounts, sessions, depositRows, periods] = await Promise.all([
      this.db.query<BankAccountRow>(
        `
        SELECT
          id,
          school_id,
          account_code,
          display_name,
          currency_code,
          institution_name,
          account_reference_masked,
          is_active,
          created_at,
          updated_at
        FROM finance_bank_accounts
        WHERE school_id = $1
          AND deleted_at IS NULL
        ORDER BY is_active DESC, display_name, account_code
        `,
        [query.schoolId],
      ),
      this.availableSessions(this.db, query.schoolId),
      this.db.query<DepositRow>(
        `
        SELECT
          deposit.id,
          deposit.school_id,
          deposit.bank_account_id,
          account.account_code AS bank_account_code,
          account.display_name AS bank_account_name,
          deposit.currency_code,
          deposit.deposit_date,
          deposit.expected_amount,
          deposit.deposited_amount,
          deposit.variance_amount,
          deposit.deposit_reference,
          deposit.evidence_note,
          deposit.reconciliation_status,
          deposit.requested_by_user_id,
          requester.first_name AS requester_first_name,
          requester.last_name AS requester_last_name,
          deposit.requested_at,
          deposit.reviewed_by_user_id,
          reviewer.first_name AS reviewer_first_name,
          reviewer.last_name AS reviewer_last_name,
          deposit.reviewed_at,
          deposit.review_note,
          deposit.created_at
        FROM finance_deposits deposit
        JOIN finance_bank_accounts account
          ON account.id = deposit.bank_account_id
         AND account.school_id = deposit.school_id
        JOIN users requester
          ON requester.id = deposit.requested_by_user_id
        LEFT JOIN users reviewer
          ON reviewer.id = deposit.reviewed_by_user_id
        WHERE deposit.school_id = $1
          AND ($2::text IS NULL OR deposit.reconciliation_status = $2)
        ORDER BY deposit.created_at DESC
        LIMIT $3
        `,
        [query.schoolId, query.status ?? null, query.limit ?? 100],
      ),
      this.db.query<PeriodRow>(
        `
        SELECT
          id,
          school_id,
          period_code,
          display_name,
          start_date,
          end_date,
          period_status,
          closed_at,
          close_reason,
          reopened_at,
          reopen_reason,
          reopen_count,
          created_at,
          updated_at
        FROM finance_accounting_periods
        WHERE school_id = $1
          AND deleted_at IS NULL
        ORDER BY start_date DESC, period_code
        LIMIT 100
        `,
        [query.schoolId],
      ),
    ]);

    const deposits = await Promise.all(
      depositRows.rows.map(async (deposit) =>
        this.mapDeposit(
          deposit,
          await this.loadDepositSessions(this.db, deposit.id),
        ),
      ),
    );
    return {
      bankAccounts: accounts.rows.map((row) => this.mapBankAccount(row)),
      availableCashierSessions: sessions.map((row) => this.mapSession(row)),
      deposits,
      periods: periods.rows.map((row) => this.mapPeriod(row)),
    };
  }

  async createBankAccount(
    dto: CreateFinanceBankAccountDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    const accountCode = dto.accountCode.trim().toUpperCase();
    const currencyCode = dto.currencyCode.trim().toUpperCase();
    try {
      return await this.db.withTransaction(async (client) => {
        const result = await client.query<{ id: string }>(
          `
          INSERT INTO finance_bank_accounts (
            school_id,
            account_code,
            display_name,
            currency_code,
            institution_name,
            account_reference_masked,
            created_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
          `,
          [
            dto.schoolId,
            accountCode,
            dto.displayName.trim(),
            currencyCode,
            dto.institutionName?.trim() || null,
            dto.accountReferenceMasked?.trim() || null,
            actorUserId,
          ],
        );
        const account = await this.loadBankAccount(
          client,
          dto.schoolId,
          result.rows[0].id,
        );
        await client.query(
          `
          INSERT INTO finance_reconciliation_events (
            school_id,
            subject_type,
            subject_id,
            event_type,
            actor_user_id,
            event_payload
          )
          VALUES ($1, 'BANK_ACCOUNT', $2, 'CREATED', $3, $4::jsonb)
          `,
          [
            dto.schoolId,
            account.id,
            actorUserId,
            JSON.stringify({ accountCode, currencyCode }),
          ],
        );
        await this.activity.recordTx(client, {
          eventType: 'FINANCE_BANK_ACCOUNT_CREATED',
          actorType: this.actorType(platformRole),
          actorUserId,
          schoolId: dto.schoolId,
          summary: `Finance bank destination ${accountCode} created.`,
          payload: {
            bankAccountId: account.id,
            accountCode,
            currencyCode,
          },
        });
        return this.mapBankAccount(account);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'A finance bank destination with this code already exists.',
        );
      }
      throw error;
    }
  }

  async updateBankAccountStatus(
    bankAccountId: string,
    dto: UpdateFinanceBankAccountStatusDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    return this.db.withTransaction(async (client) => {
      const account = await this.loadBankAccount(
        client,
        dto.schoolId,
        bankAccountId,
        true,
      );
      if (account.is_active === dto.isActive) {
        return this.mapBankAccount(account);
      }
      if (!dto.isActive) {
        const pending = await client.query(
          `
          SELECT 1
          FROM finance_deposits
          WHERE bank_account_id = $1
            AND school_id = $2
            AND reconciliation_status = 'PENDING_REVIEW'
          LIMIT 1
          `,
          [bankAccountId, dto.schoolId],
        );
        if (pending.rowCount) {
          throw new ConflictException(
            'This bank destination has deposits awaiting review.',
          );
        }
      }
      await client.query(
        `
        UPDATE finance_bank_accounts
        SET
          is_active = $3,
          archived_at = CASE WHEN $3 THEN NULL ELSE NOW() END,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [bankAccountId, dto.schoolId, dto.isActive],
      );
      const updated = await this.loadBankAccount(
        client,
        dto.schoolId,
        bankAccountId,
      );
      const eventType = dto.isActive ? 'REACTIVATED' : 'ARCHIVED';
      await client.query(
        `
        INSERT INTO finance_reconciliation_events (
          school_id,
          subject_type,
          subject_id,
          event_type,
          actor_user_id
        )
        VALUES ($1, 'BANK_ACCOUNT', $2, $3, $4)
        `,
        [dto.schoolId, bankAccountId, eventType, actorUserId],
      );
      await this.activity.recordTx(client, {
        eventType: `FINANCE_BANK_ACCOUNT_${eventType}`,
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Finance bank destination ${account.account_code} ${eventType.toLowerCase()}.`,
        payload: { bankAccountId, isActive: dto.isActive },
      });
      return this.mapBankAccount(updated);
    });
  }

  async createDeposit(
    dto: CreateFinanceDepositDto,
    actorUserId: string,
    platformRole: PlatformRole,
    rawIdempotencyKey?: string,
  ) {
    const idempotencyKey = this.normalizeIdempotencyKey(rawIdempotencyKey);
    const sessionIds = [...new Set(dto.cashierSessionIds)].sort();
    if (sessionIds.length !== dto.cashierSessionIds.length) {
      throw new BadRequestException(
        'Each cashier session may be selected only once.',
      );
    }
    const depositedAmount = Number(dto.depositedAmount.toFixed(2));
    const requestHash = this.hash({
      bankAccountId: dto.bankAccountId,
      sessionIds,
      depositDate: dto.depositDate,
      depositedAmount,
      depositReference: dto.depositReference.trim(),
      evidenceNote: dto.evidenceNote?.trim() || null,
    });

    return this.db.withTransaction(async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`finance-deposit:${dto.schoolId}:${idempotencyKey}`],
      );
      const replay = await client.query<{
        id: string;
        request_hash: string;
      }>(
        `
        SELECT id, request_hash
        FROM finance_deposits
        WHERE school_id = $1
          AND idempotency_key = $2
        LIMIT 1
        `,
        [dto.schoolId, idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].request_hash !== requestHash) {
          throw new ConflictException(
            'This idempotency key was already used for a different deposit.',
          );
        }
        const existing = await this.loadDeposit(
          client,
          dto.schoolId,
          replay.rows[0].id,
        );
        return this.mapDeposit(
          existing,
          await this.loadDepositSessions(client, existing.id),
        );
      }

      await assertFinanceDateOpen(
        client,
        dto.schoolId,
        dto.depositDate,
        'Deposit submission',
      );
      if (dto.depositDate > this.dateOnly()) {
        throw new BadRequestException('Deposit date cannot be in the future.');
      }
      const account = await this.loadBankAccount(
        client,
        dto.schoolId,
        dto.bankAccountId,
        true,
      );
      if (!account.is_active) {
        throw new ConflictException(
          'The selected finance bank destination is inactive.',
        );
      }
      const sessions = await this.availableSessions(
        client,
        dto.schoolId,
        sessionIds,
        true,
      );
      if (sessions.length !== sessionIds.length) {
        throw new ConflictException(
          'One or more cashier sessions are unavailable, empty, or already assigned to a deposit.',
        );
      }
      if (
        sessions.some(
          (session) => session.currency_code !== account.currency_code,
        )
      ) {
        throw new BadRequestException(
          'Cashier session currency must match the bank destination.',
        );
      }
      if (
        sessions.some((session) => session.business_date > dto.depositDate)
      ) {
        throw new BadRequestException(
          'Deposit date cannot be earlier than a selected cashier session.',
        );
      }
      const expectedAmount = Number(
        sessions
          .reduce(
            (sum, session) => sum + Number(session.ledger_collection_amount),
            0,
          )
          .toFixed(2),
      );
      const varianceAmount = Number(
        (depositedAmount - expectedAmount).toFixed(2),
      );
      const inserted = await client.query<{ id: string }>(
        `
        INSERT INTO finance_deposits (
          school_id,
          bank_account_id,
          currency_code,
          deposit_date,
          expected_amount,
          deposited_amount,
          variance_amount,
          deposit_reference,
          evidence_note,
          requested_by_user_id,
          idempotency_key,
          request_hash
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        RETURNING id
        `,
        [
          dto.schoolId,
          account.id,
          account.currency_code,
          dto.depositDate,
          expectedAmount,
          depositedAmount,
          varianceAmount,
          dto.depositReference.trim(),
          dto.evidenceNote?.trim() || null,
          actorUserId,
          idempotencyKey,
          requestHash,
        ],
      );
      for (const session of sessions) {
        await client.query(
          `
          INSERT INTO finance_deposit_cashier_sessions (
            school_id,
            deposit_id,
            cashier_session_id,
            expected_collection_amount
          )
          VALUES ($1, $2, $3, $4)
          `,
          [
            dto.schoolId,
            inserted.rows[0].id,
            session.id,
            Number(session.ledger_collection_amount),
          ],
        );
      }
      await client.query(
        `
        INSERT INTO finance_reconciliation_events (
          school_id,
          subject_type,
          subject_id,
          event_type,
          actor_user_id,
          event_payload
        )
        VALUES ($1, 'DEPOSIT', $2, 'SUBMITTED', $3, $4::jsonb)
        `,
        [
          dto.schoolId,
          inserted.rows[0].id,
          actorUserId,
          JSON.stringify({
            bankAccountId: account.id,
            cashierSessionIds: sessionIds,
            expectedAmount,
            depositedAmount,
            varianceAmount,
          }),
        ],
      );
      await this.activity.recordTx(client, {
        eventType: 'FINANCE_DEPOSIT_SUBMITTED',
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: 'Cash deposit submitted for independent review.',
        payload: {
          depositId: inserted.rows[0].id,
          bankAccountId: account.id,
          cashierSessionIds: sessionIds,
          expectedAmount,
          depositedAmount,
          varianceAmount,
        },
      });
      const deposit = await this.loadDeposit(
        client,
        dto.schoolId,
        inserted.rows[0].id,
      );
      const mapped = this.mapDeposit(
        deposit,
        await this.loadDepositSessions(client, deposit.id),
      );
      await client.query(
        `
        UPDATE finance_deposits
        SET response_body = $2::jsonb
        WHERE id = $1
        `,
        [deposit.id, JSON.stringify(mapped)],
      );
      return mapped;
    });
  }

  private async reviewDeposit(
    depositId: string,
    dto: ReviewFinanceDepositDto,
    actorUserId: string,
    platformRole: PlatformRole,
    status: 'RECONCILED' | 'REJECTED',
  ) {
    return this.db.withTransaction(async (client) => {
      const deposit = await this.loadDeposit(
        client,
        dto.schoolId,
        depositId,
        true,
      );
      if (deposit.reconciliation_status !== 'PENDING_REVIEW') {
        throw new ConflictException('This deposit has already been reviewed.');
      }
      if (deposit.requested_by_user_id === actorUserId) {
        throw new ConflictException(
          'The person who submitted a deposit cannot review it.',
        );
      }
      await client.query(
        `
        UPDATE finance_deposits
        SET
          reconciliation_status = $3,
          reviewed_by_user_id = $4,
          reviewed_at = NOW(),
          review_note = $5,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [depositId, dto.schoolId, status, actorUserId, dto.reviewNote.trim()],
      );
      if (status === 'REJECTED') {
        await client.query(
          `
          UPDATE finance_deposit_cashier_sessions
          SET released_at = NOW()
          WHERE deposit_id = $1
            AND released_at IS NULL
          `,
          [depositId],
        );
      }
      await client.query(
        `
        INSERT INTO finance_reconciliation_events (
          school_id,
          subject_type,
          subject_id,
          event_type,
          actor_user_id,
          event_payload
        )
        VALUES ($1, 'DEPOSIT', $2, $3, $4, $5::jsonb)
        `,
        [
          dto.schoolId,
          depositId,
          status,
          actorUserId,
          JSON.stringify({ reviewNote: dto.reviewNote.trim() }),
        ],
      );
      await this.activity.recordTx(client, {
        eventType: `FINANCE_DEPOSIT_${status}`,
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Cash deposit ${status.toLowerCase()}.`,
        payload: {
          depositId,
          expectedAmount: Number(deposit.expected_amount),
          depositedAmount: Number(deposit.deposited_amount),
          varianceAmount: Number(deposit.variance_amount),
        },
      });
      const updated = await this.loadDeposit(
        client,
        dto.schoolId,
        depositId,
      );
      return this.mapDeposit(
        updated,
        await this.loadDepositSessions(client, depositId),
      );
    });
  }

  reconcileDeposit(
    depositId: string,
    dto: ReviewFinanceDepositDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    return this.reviewDeposit(
      depositId,
      dto,
      actorUserId,
      platformRole,
      'RECONCILED',
    );
  }

  rejectDeposit(
    depositId: string,
    dto: ReviewFinanceDepositDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    return this.reviewDeposit(
      depositId,
      dto,
      actorUserId,
      platformRole,
      'REJECTED',
    );
  }

  async createPeriod(
    dto: CreateFinanceAccountingPeriodDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'Financial period end date must not precede its start date.',
      );
    }
    const periodCode = dto.periodCode.trim().toUpperCase();
    try {
      return await this.db.withTransaction(async (client) => {
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          [`finance-period:${dto.schoolId}`],
        );
        const overlap = await client.query(
          `
          SELECT 1
          FROM finance_accounting_periods
          WHERE school_id = $1
            AND deleted_at IS NULL
            AND daterange(start_date, end_date, '[]')
              && daterange($2::date, $3::date, '[]')
          LIMIT 1
          `,
          [dto.schoolId, dto.startDate, dto.endDate],
        );
        if (overlap.rowCount) {
          throw new ConflictException(
            'Financial accounting periods cannot overlap.',
          );
        }
        const inserted = await client.query<{ id: string }>(
          `
          INSERT INTO finance_accounting_periods (
            school_id,
            period_code,
            display_name,
            start_date,
            end_date,
            created_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
          `,
          [
            dto.schoolId,
            periodCode,
            dto.displayName.trim(),
            dto.startDate,
            dto.endDate,
            actorUserId,
          ],
        );
        const period = await this.loadPeriod(
          client,
          dto.schoolId,
          inserted.rows[0].id,
        );
        await client.query(
          `
          INSERT INTO finance_reconciliation_events (
            school_id,
            subject_type,
            subject_id,
            event_type,
            actor_user_id,
            event_payload
          )
          VALUES ($1, 'ACCOUNTING_PERIOD', $2, 'CREATED', $3, $4::jsonb)
          `,
          [
            dto.schoolId,
            period.id,
            actorUserId,
            JSON.stringify({
              periodCode,
              startDate: dto.startDate,
              endDate: dto.endDate,
            }),
          ],
        );
        await this.activity.recordTx(client, {
          eventType: 'FINANCE_ACCOUNTING_PERIOD_CREATED',
          actorType: this.actorType(platformRole),
          actorUserId,
          schoolId: dto.schoolId,
          summary: `Financial period ${periodCode} created.`,
          payload: {
            periodId: period.id,
            periodCode,
            startDate: dto.startDate,
            endDate: dto.endDate,
          },
        });
        return this.mapPeriod(period);
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'A financial period with this code already exists.',
        );
      }
      throw error;
    }
  }

  private async loadPeriod(
    client: QueryClient,
    schoolId: string,
    periodId: string,
    lock = false,
  ) {
    const result = await client.query<PeriodRow>(
      `
      SELECT
        id,
        school_id,
        period_code,
        display_name,
        start_date,
        end_date,
        period_status,
        closed_at,
        close_reason,
        reopened_at,
        reopen_reason,
        reopen_count,
        created_at,
        updated_at
      FROM finance_accounting_periods
      WHERE id = $1
        AND school_id = $2
        AND deleted_at IS NULL
      LIMIT 1
      ${lock ? 'FOR UPDATE' : ''}
      `,
      [periodId, schoolId],
    );
    const period = result.rows[0];
    if (!period) {
      throw new NotFoundException('Financial accounting period not found.');
    }
    return period;
  }

  private async periodCloseBlockers(
    client: QueryClient,
    period: PeriodRow,
  ) {
    const result = await client.query<{
      open_sessions: string;
      pending_deposits: string;
      pending_payment_corrections: string;
      pending_credit_notes: string;
      unreconciled_cashier_sessions: string;
    }>(
      `
      SELECT
        (
          SELECT COUNT(*)::text
          FROM finance_cashier_sessions session
          WHERE session.school_id = $1
            AND session.business_date BETWEEN $2 AND $3
            AND session.session_status = 'OPEN'
            AND session.deleted_at IS NULL
        ) AS open_sessions,
        (
          SELECT COUNT(*)::text
          FROM finance_deposits deposit
          WHERE deposit.school_id = $1
            AND deposit.deposit_date BETWEEN $2 AND $3
            AND deposit.reconciliation_status = 'PENDING_REVIEW'
        ) AS pending_deposits,
        (
          SELECT COUNT(*)::text
          FROM finance_payment_corrections correction
          JOIN payments payment
            ON payment.id = correction.payment_id
           AND payment.school_id = correction.school_id
          WHERE correction.school_id = $1
            AND payment.payment_date::date BETWEEN $2 AND $3
            AND correction.correction_status IN (
              'PENDING_REVIEW',
              'APPROVED'
            )
        ) AS pending_payment_corrections,
        (
          SELECT COUNT(*)::text
          FROM finance_invoice_credit_notes note
          JOIN invoices invoice
            ON invoice.id = note.invoice_id
           AND invoice.school_id = note.school_id
          WHERE note.school_id = $1
            AND invoice.issue_date BETWEEN $2 AND $3
            AND note.credit_note_status = 'PENDING_REVIEW'
        ) AS pending_credit_notes,
        (
          SELECT COUNT(*)::text
          FROM finance_cashier_sessions session
          WHERE session.school_id = $1
            AND session.business_date BETWEEN $2 AND $3
            AND session.session_status = 'CLOSED'
            AND session.deleted_at IS NULL
            AND (
              COALESCE((
                SELECT SUM(payment.amount)
                FROM payments payment
                WHERE payment.cashier_session_id = session.id
                  AND payment.payment_status = 'CONFIRMED'
                  AND payment.payment_method = 'CASH'
                  AND payment.deleted_at IS NULL
              ), 0)
              -
              COALESCE((
                SELECT SUM(correction.amount)
                FROM finance_payment_corrections correction
                WHERE correction.cashier_session_id = session.id
                  AND correction.correction_type = 'REFUND'
                  AND correction.correction_status = 'COMPLETED'
                  AND correction.refund_method = 'CASH'
              ), 0)
            ) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM finance_deposit_cashier_sessions link
              JOIN finance_deposits deposit
                ON deposit.id = link.deposit_id
               AND deposit.school_id = link.school_id
              WHERE link.cashier_session_id = session.id
                AND link.released_at IS NULL
                AND deposit.reconciliation_status = 'RECONCILED'
            )
        ) AS unreconciled_cashier_sessions
      `,
      [period.school_id, period.start_date, period.end_date],
    );
    const row = result.rows[0];
    return {
      openCashierSessions: Number(row.open_sessions),
      pendingDeposits: Number(row.pending_deposits),
      pendingPaymentCorrections: Number(row.pending_payment_corrections),
      pendingCreditNotes: Number(row.pending_credit_notes),
      unreconciledCashierSessions: Number(row.unreconciled_cashier_sessions),
    };
  }

  async closePeriod(
    periodId: string,
    dto: FinancePeriodActionDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    return this.db.withTransaction(async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`finance-period:${dto.schoolId}`],
      );
      const period = await this.loadPeriod(
        client,
        dto.schoolId,
        periodId,
        true,
      );
      if (period.period_status === 'CLOSED') {
        return {
          ...this.mapPeriod(period),
          blockers: await this.periodCloseBlockers(client, period),
        };
      }
      const blockers = await this.periodCloseBlockers(client, period);
      if (Object.values(blockers).some((count) => count > 0)) {
        throw new ConflictException({
          message:
            'The financial period cannot close until all operational blockers are resolved.',
          blockers,
        });
      }
      await client.query(
        `
        UPDATE finance_accounting_periods
        SET
          period_status = 'CLOSED',
          closed_by_user_id = $3,
          closed_at = NOW(),
          close_reason = $4,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [periodId, dto.schoolId, actorUserId, dto.reason.trim()],
      );
      await client.query(
        `
        INSERT INTO finance_reconciliation_events (
          school_id,
          subject_type,
          subject_id,
          event_type,
          actor_user_id,
          event_payload
        )
        VALUES ($1, 'ACCOUNTING_PERIOD', $2, 'CLOSED', $3, $4::jsonb)
        `,
        [
          dto.schoolId,
          periodId,
          actorUserId,
          JSON.stringify({ reason: dto.reason.trim(), blockers }),
        ],
      );
      await this.activity.recordTx(client, {
        eventType: 'FINANCE_ACCOUNTING_PERIOD_CLOSED',
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Financial period ${period.period_code} closed.`,
        payload: {
          periodId,
          periodCode: period.period_code,
          startDate: period.start_date,
          endDate: period.end_date,
        },
      });
      const updated = await this.loadPeriod(client, dto.schoolId, periodId);
      return { ...this.mapPeriod(updated), blockers };
    });
  }

  async reopenPeriod(
    periodId: string,
    dto: FinancePeriodActionDto,
    actorUserId: string,
    platformRole: PlatformRole,
  ) {
    return this.db.withTransaction(async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`finance-period:${dto.schoolId}`],
      );
      const period = await this.loadPeriod(
        client,
        dto.schoolId,
        periodId,
        true,
      );
      if (period.period_status === 'OPEN') {
        return this.mapPeriod(period);
      }
      await client.query(
        `
        UPDATE finance_accounting_periods
        SET
          period_status = 'OPEN',
          closed_by_user_id = NULL,
          closed_at = NULL,
          close_reason = NULL,
          reopened_by_user_id = $3,
          reopened_at = NOW(),
          reopen_reason = $4,
          reopen_count = reopen_count + 1,
          updated_at = NOW()
        WHERE id = $1
          AND school_id = $2
        `,
        [periodId, dto.schoolId, actorUserId, dto.reason.trim()],
      );
      await client.query(
        `
        INSERT INTO finance_reconciliation_events (
          school_id,
          subject_type,
          subject_id,
          event_type,
          actor_user_id,
          event_payload
        )
        VALUES ($1, 'ACCOUNTING_PERIOD', $2, 'REOPENED', $3, $4::jsonb)
        `,
        [
          dto.schoolId,
          periodId,
          actorUserId,
          JSON.stringify({
            reason: dto.reason.trim(),
            previousClosedAt: period.closed_at,
            previousCloseReason: period.close_reason,
          }),
        ],
      );
      await this.activity.recordTx(client, {
        eventType: 'FINANCE_ACCOUNTING_PERIOD_REOPENED',
        actorType: this.actorType(platformRole),
        actorUserId,
        schoolId: dto.schoolId,
        summary: `Financial period ${period.period_code} reopened.`,
        payload: {
          periodId,
          periodCode: period.period_code,
          reason: dto.reason.trim(),
        },
      });
      return this.mapPeriod(
        await this.loadPeriod(client, dto.schoolId, periodId),
      );
    });
  }
}
