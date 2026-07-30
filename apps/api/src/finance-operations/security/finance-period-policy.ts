import { ConflictException } from '@nestjs/common';
import type { PoolClient } from 'pg';

type QueryClient = Pick<PoolClient, 'query'>;

export async function assertFinanceDateOpen(
  client: QueryClient,
  schoolId: string,
  dateValue: string,
  operation: string,
) {
  const result = await client.query<{
    period_code: string;
    display_name: string;
  }>(
    `
    SELECT period_code, display_name
    FROM finance_accounting_periods
    WHERE school_id = $1
      AND period_status = 'CLOSED'
      AND deleted_at IS NULL
      AND $2::date BETWEEN start_date AND end_date
    LIMIT 1
    `,
    [schoolId, dateValue],
  );

  const period = result.rows[0];
  if (period) {
    throw new ConflictException(
      `${operation} is blocked because financial period ${period.period_code} is closed.`,
    );
  }
}
