import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

type OverdueInvoiceRow = {
  id: string;
  invoice_number: string;
  student_id: string;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
  issue_date: string;
  due_date: string;
  total_amount: string;
  balance_due: string;
  status: 'OVERDUE';
};

@Injectable()
export class FinanceAdminService {
  constructor(private readonly db: DbService) {}

  async findOverdue(schoolId: string): Promise<OverdueInvoiceRow[]> {
    const result = await this.db.query<OverdueInvoiceRow>(
      `
      SELECT
        i.id,
        i.invoice_number,
        i.student_id,
        s.student_number,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        i.issue_date,
        i.due_date,
        i.total_amount,
        i.balance_due,
        i.status
      FROM invoices i
      JOIN students s ON s.id = i.student_id
      WHERE i.school_id = $1
        AND i.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND i.status = 'OVERDUE'
      ORDER BY i.due_date ASC, s.last_name ASC
      `,
      [schoolId],
    );

    return result.rows;
  }
}