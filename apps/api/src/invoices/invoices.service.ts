import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';

type InvoiceRow = {
  id: string;
  school_id: string;
  student_id: string;
  academic_year_id: string;
  grading_period_id: string | null;
  invoice_number: string;
  status:
    | 'DRAFT'
    | 'ISSUED'
    | 'PARTIAL'
    | 'PARTIALLY_PAID'
    | 'PAID'
    | 'OVERDUE'
    | 'VOID';
  issue_date: string;
  due_date: string;
  currency_code: string;
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  created_at: string;
  updated_at: string;
};

type InvoiceLineRow = {
  id: string;
  invoice_id: string;
  fee_plan_id: string | null;
  label_i18n: Record<string, string>;
  quantity: string;
  unit_amount: string;
  discount_amount: string;
  line_total: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class InvoicesService {
  constructor(private readonly db: DbService) {}

  async findAll(schoolId: string, studentId: string) {
    const invoicesResult = await this.db.query<InvoiceRow>(
      `
        SELECT
          id,
          school_id,
          student_id,
          academic_year_id,
          grading_period_id,
          invoice_number,
          invoice_status::text AS status,
          issue_date,
          due_date,
          currency_code,
          subtotal_amount,
          discount_amount,
          total_amount,
          amount_paid,
          balance_due,
          created_at,
          updated_at
        FROM invoices
        WHERE school_id = $1
          AND student_id = $2
          AND deleted_at IS NULL
          AND invoice_status <> 'DRAFT'
        ORDER BY issue_date DESC, created_at DESC
        `,
      [schoolId, studentId],
    );

    return invoicesResult.rows;
  }

  async findParentSummary(
    schoolId: string,
    guardianId: string,
    studentId: string,
  ) {
    const accessCheck = await this.db.query(
      `
        SELECT sg.id
        FROM student_guardians sg
        JOIN guardians g ON g.id = sg.guardian_id
        WHERE sg.guardian_id = $1
          AND sg.student_id = $2
          AND sg.school_id = $3
          AND g.school_id = $3
          AND sg.can_view_finance = TRUE
          AND sg.deleted_at IS NULL
          AND g.deleted_at IS NULL
        LIMIT 1
        `,
      [guardianId, studentId, schoolId],
    );

    if (accessCheck.rows.length === 0) {
      throw new ForbiddenException(
        'Guardian does not have finance access to this student.',
      );
    }

    const studentResult = await this.db.query<{
      id: string;
      student_number: string;
      first_name: string;
      last_name: string;
    }>(
      `
        SELECT id, student_number, first_name, last_name
        FROM students
        WHERE id = $1
          AND school_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
      [studentId, schoolId],
    );

    const student = studentResult.rows[0];

    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found.`);
    }

    const invoices = await this.findAll(schoolId, studentId);
    const totalsByCurrency = Array.from(
      invoices
        .filter((invoice) => invoice.status !== 'VOID')
        .reduce(
          (totals, invoice) => {
            const current = totals.get(invoice.currency_code) ?? {
              currencyCode: invoice.currency_code,
              totalInvoiced: 0,
              totalPaid: 0,
              totalOutstanding: 0,
            };
            current.totalInvoiced = Number(
              (current.totalInvoiced + Number(invoice.total_amount)).toFixed(2),
            );
            current.totalPaid = Number(
              (current.totalPaid + Number(invoice.amount_paid)).toFixed(2),
            );
            current.totalOutstanding = Number(
              (
                current.totalOutstanding + Number(invoice.balance_due)
              ).toFixed(2),
            );
            totals.set(invoice.currency_code, current);
            return totals;
          },
          new Map<
            string,
            {
              currencyCode: string;
              totalInvoiced: number;
              totalPaid: number;
              totalOutstanding: number;
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
        studentNumber: student.student_number,
        firstName: student.first_name,
        lastName: student.last_name,
      },
      totalsByCurrency,
      invoices,
    };
  }

  async generate(dto: GenerateInvoiceDto) {
    if (dto.dueDate < dto.issueDate) {
      throw new BadRequestException('Due date cannot be before issue date.');
    }

    return this.db.withTransaction(async (client) => {
      const studentContext = await this.getStudentSchoolContext(
        client,
        dto.studentId,
        dto.academicYearId,
      );

      const invoiceNumber = `INV-${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}`;

      let subtotal = 0;
      let discount = 0;

      const preparedLines = dto.lineItems.map((line) => {
        const lineSubtotal = line.quantity * line.unitAmount;
        const lineDiscount = line.discountAmount ?? 0;
        const lineTotal = Math.max(0, lineSubtotal - lineDiscount);

        subtotal += lineSubtotal;
        discount += lineDiscount;

        return {
          feePlanId: line.feePlanId ?? null,
          labelI18n: line.labelI18n,
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          discountAmount: lineDiscount,
          lineTotal,
        };
      });

      const total = Math.max(0, subtotal - discount);

      const invoiceResult = await client.query<InvoiceRow>(
        `
          INSERT INTO invoices (
            school_id,
            student_id,
            academic_year_id,
            grading_period_id,
            invoice_number,
            status,
            issue_date,
            due_date,
            currency_code,
            subtotal_amount,
            discount_amount,
            total_amount,
            balance_due
          )
          VALUES (
            $1, $2, $3, $4, $5, 'ISSUED', $6, $7, $8, $9, $10, $11, $11
          )
          RETURNING
            id,
            school_id,
            student_id,
            academic_year_id,
            grading_period_id,
            invoice_number,
            status,
            issue_date,
            due_date,
            currency_code,
            subtotal_amount,
            discount_amount,
            total_amount,
            balance_due,
            created_at,
            updated_at
          `,
        [
          studentContext.school_id,
          dto.studentId,
          dto.academicYearId,
          dto.gradingPeriodId ?? null,
          invoiceNumber,
          dto.issueDate,
          dto.dueDate,
          dto.currencyCode,
          subtotal,
          discount,
          total,
        ],
      );

      const invoice = invoiceResult.rows[0];

      for (const line of preparedLines) {
        await client.query(
          `
            INSERT INTO invoice_lines (
              invoice_id,
              fee_plan_id,
              label_i18n,
              quantity,
              unit_amount,
              discount_amount,
              line_total
            )
            VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
            `,
          [
            invoice.id,
            line.feePlanId,
            JSON.stringify(line.labelI18n),
            line.quantity,
            line.unitAmount,
            line.discountAmount,
            line.lineTotal,
          ],
        );
      }

      return {
        invoice,
        lines: await this.getInvoiceLines(client, invoice.id),
      };
    });
  }

  async recalculate(invoiceId: string) {
    return this.db.withTransaction(async (client) => {
      const invoiceResult = await client.query<InvoiceRow>(
        `
          SELECT
            id,
            school_id,
            student_id,
            academic_year_id,
            grading_period_id,
            invoice_number,
            status,
            issue_date,
            due_date,
            currency_code,
            subtotal_amount,
            discount_amount,
            total_amount,
            balance_due,
            created_at,
            updated_at
          FROM invoices
          WHERE id = $1
            AND deleted_at IS NULL
          LIMIT 1
          `,
        [invoiceId],
      );

      const invoice = invoiceResult.rows[0];

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found.`);
      }

      if (invoice.status === 'VOID') {
        throw new BadRequestException('Cannot recalculate a void invoice.');
      }

      const lines = await this.getInvoiceLines(client, invoiceId);

      const activeDiscounts = await client.query<{
        discount_type: 'PERCENT' | 'FIXED';
        value: string;
        scope: 'TUITION' | 'TRANSPORT' | 'ALL';
      }>(
        `
          SELECT discount_type, value, scope
          FROM student_discounts
          WHERE student_id = $1
            AND deleted_at IS NULL
            AND start_date <= $2
            AND (end_date IS NULL OR end_date >= $2)
          `,
        [invoice.student_id, invoice.issue_date],
      );

      let subtotal = 0;
      let totalDiscount = 0;

      for (const line of lines) {
        const lineBase = Number(line.quantity) * Number(line.unit_amount);
        subtotal += lineBase;

        const frLabel = (line.label_i18n?.fr ?? '').toLowerCase();
        const enLabel = (line.label_i18n?.en ?? '').toLowerCase();

        const isTransport =
          frLabel.includes('transport') || enLabel.includes('transport');
        const isTuition =
          frLabel.includes('scolar') ||
          enLabel.includes('tuition') ||
          frLabel.includes('tuition');

        let lineDiscount = 0;

        for (const d of activeDiscounts.rows) {
          const scopeMatches =
            d.scope === 'ALL' ||
            (d.scope === 'TRANSPORT' && isTransport) ||
            (d.scope === 'TUITION' && isTuition);

          if (!scopeMatches) continue;

          if (d.discount_type === 'PERCENT') {
            lineDiscount += lineBase * (Number(d.value) / 100);
          } else {
            lineDiscount += Number(d.value);
          }
        }

        if (lineDiscount > lineBase) {
          lineDiscount = lineBase;
        }

        const lineTotal = Math.max(0, lineBase - lineDiscount);
        totalDiscount += lineDiscount;

        await client.query(
          `
            UPDATE invoice_lines
            SET
              discount_amount = $2,
              line_total = $3,
              updated_at = NOW()
            WHERE id = $1
            `,
          [line.id, lineDiscount, lineTotal],
        );
      }

      const paidAmount =
        Number(invoice.total_amount) - Number(invoice.balance_due);
      const newTotal = Math.max(0, subtotal - totalDiscount);
      const newBalance = Math.max(0, newTotal - paidAmount);

      let newStatus: InvoiceRow['status'] = 'ISSUED';
      if (newBalance === 0) {
        newStatus = 'PAID';
      } else if (paidAmount > 0) {
        newStatus = 'PARTIAL';
      } else if (invoice.status === 'OVERDUE') {
        newStatus = 'OVERDUE';
      }

      const updatedInvoiceResult = await client.query<InvoiceRow>(
        `
          UPDATE invoices
          SET
            subtotal_amount = $2,
            discount_amount = $3,
            total_amount = $4,
            balance_due = $5,
            status = $6,
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            school_id,
            student_id,
            academic_year_id,
            grading_period_id,
            invoice_number,
            status,
            issue_date,
            due_date,
            currency_code,
            subtotal_amount,
            discount_amount,
            total_amount,
            balance_due,
            created_at,
            updated_at
          `,
        [invoiceId, subtotal, totalDiscount, newTotal, newBalance, newStatus],
      );

      return {
        invoice: updatedInvoiceResult.rows[0],
        lines: await this.getInvoiceLines(client, invoiceId),
      };
    });
  }

  async markOverdue() {
    const result = await this.db.query<{
      id: string;
      invoice_number: string;
      due_date: string;
      balance_due: string;
    }>(
      `
        UPDATE invoices
        SET
          status = 'OVERDUE',
          updated_at = NOW()
        WHERE deleted_at IS NULL
          AND status IN ('ISSUED', 'PARTIAL')
          AND balance_due > 0
          AND due_date < CURRENT_DATE
        RETURNING id, invoice_number, due_date, balance_due
        `,
    );

    return {
      count: result.rows.length,
      invoices: result.rows,
    };
  }

  private async getStudentSchoolContext(
    client: PoolClient,
    studentId: string,
    academicYearId: string,
  ) {
    const result = await client.query<{ school_id: string }>(
      `
        SELECT s.school_id
        FROM students s
        JOIN enrollments e ON e.student_id = s.id
        WHERE s.id = $1
          AND e.academic_year_id = $2
          AND e.deleted_at IS NULL
          AND s.deleted_at IS NULL
        LIMIT 1
        `,
      [studentId, academicYearId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException(
        `Could not resolve school context for student ${studentId}.`,
      );
    }

    return row;
  }

  private async getInvoiceLines(client: PoolClient, invoiceId: string) {
    const result = await client.query<InvoiceLineRow>(
      `
        SELECT
          id,
          invoice_id,
          fee_plan_id,
          label_i18n,
          quantity,
          unit_amount,
          discount_amount,
          line_total,
          created_at,
          updated_at
        FROM invoice_lines
        WHERE invoice_id = $1
          AND deleted_at IS NULL
        ORDER BY created_at ASC
        `,
      [invoiceId],
    );

    return result.rows;
  }
}
