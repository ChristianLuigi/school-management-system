import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { RecordPaymentDto } from './dto/record-payment.dto';

type PaymentRow = {
  id: string;
  invoice_id: string;
  student_id: string;
  payment_date: string;
  amount: string;
  payment_method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'MOBILE_MONEY';
  reference_no: string | null;
  receipt_number: string;
  recorded_by_user_id: string;
  status: 'RECORDED' | 'REVERSED';
  created_at: string;
  updated_at: string;
};

@Injectable()
export class PaymentsService {
  constructor(private readonly db: DbService) {}

  async findAll(invoiceId: string): Promise<PaymentRow[]> {
    const result = await this.db.query<PaymentRow>(
      `
        SELECT
          id,
          invoice_id,
          student_id,
          payment_date,
          amount,
          payment_method,
          reference_no,
          receipt_number,
          recorded_by_user_id,
          status,
          created_at,
          updated_at
        FROM payments
        WHERE invoice_id = $1
          AND deleted_at IS NULL
        ORDER BY payment_date DESC, created_at DESC
        `,
      [invoiceId],
    );

    return result.rows;
  }

  async record(dto: RecordPaymentDto) {
    return this.db.withTransaction(async (client) => {
      const invoiceResult = await client.query<{
        id: string;
        school_id: string;
        student_id: string;
        status: string;
        balance_due: string;
      }>(
        `
          SELECT
            id,
            school_id,
            student_id,
            status,
            balance_due
          FROM invoices
          WHERE id = $1
            AND deleted_at IS NULL
          LIMIT 1
          `,
        [dto.invoiceId],
      );

      const invoice = invoiceResult.rows[0];

      if (!invoice) {
        throw new NotFoundException(`Invoice ${dto.invoiceId} not found.`);
      }

      if (invoice.student_id !== dto.studentId) {
        throw new BadRequestException(
          'The provided student does not match the invoice.',
        );
      }

      if (invoice.status === 'VOID') {
        throw new BadRequestException(
          'Cannot record payment on a void invoice.',
        );
      }

      const currentBalance = Number(invoice.balance_due);

      if (dto.amount > currentBalance) {
        throw new BadRequestException(
          `Payment amount ${dto.amount} exceeds balance due ${currentBalance}.`,
        );
      }

      const receiptNumber = `RCT-${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}`;

      const paymentResult = await client.query<PaymentRow>(
        `
          INSERT INTO payments (
            invoice_id,
            student_id,
            payment_date,
            amount,
            payment_method,
            reference_no,
            receipt_number,
            recorded_by_user_id,
            status
          )
          VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4, $5, $6, $7, $8, 'RECORDED')
          RETURNING
            id,
            invoice_id,
            student_id,
            payment_date,
            amount,
            payment_method,
            reference_no,
            receipt_number,
            recorded_by_user_id,
            status,
            created_at,
            updated_at
          `,
        [
          dto.invoiceId,
          dto.studentId,
          dto.paymentDate ?? null,
          dto.amount,
          dto.paymentMethod,
          dto.referenceNo ?? null,
          receiptNumber,
          dto.recordedByUserId,
        ],
      );

      const newBalance = Math.max(0, currentBalance - dto.amount);
      const newStatus = newBalance === 0 ? 'PAID' : 'PARTIAL';

      await client.query(
        `
          UPDATE invoices
          SET
            balance_due = $2,
            status = $3,
            updated_at = NOW()
          WHERE id = $1
          `,
        [dto.invoiceId, newBalance, newStatus],
      );

      await client.query(
        `
            INSERT INTO audit_logs (
              school_id,
              actor_user_id,
              entity_table,
              entity_id,
              action,
              new_values
            )
            VALUES (
              $1,
              $2,
              'payments',
              $3,
              'PAYMENT_RECORD',
              jsonb_build_object(
                'invoice_id', $4::text,
                'amount', $5::numeric,
                'receipt_number', $6::text
              )
            )
            `,
        [
          invoice.school_id,
          dto.recordedByUserId,
          paymentResult.rows[0].id,
          dto.invoiceId,
          dto.amount,
          receiptNumber,
        ],
      );

      const payments = await this.findAll(dto.invoiceId);

      return {
        payment: paymentResult.rows[0],
        invoice: {
          id: dto.invoiceId,
          status: newStatus,
          balanceDue: newBalance,
        },
        payments,
      };
    });
  }
}
