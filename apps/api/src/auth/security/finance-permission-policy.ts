import { BadRequestException } from '@nestjs/common';

export const FINANCE_PERMISSION_CODES = [
  'FINANCE_DASHBOARD_VIEW',
  'FINANCE_INVOICES_VIEW',
  'FINANCE_INVOICES_CREATE',
  'FINANCE_INVOICES_EDIT',
  'FINANCE_INVOICES_VOID',
  'FINANCE_BILLING_MANAGE',
  'FINANCE_PAYMENTS_VIEW',
  'FINANCE_PAYMENTS_RECORD',
  'FINANCE_PAYMENTS_REVERSE',
  'FINANCE_RECEIPTS_PRINT',
  'FINANCE_CASHIER_SESSIONS_SUPERVISE',
  'FINANCE_CREDIT_NOTES_CREATE',
  'FINANCE_CORRECTIONS_APPROVE',
  'FINANCE_RECONCILIATION_MANAGE',
  'FINANCE_PERIOD_CLOSE',
  'FINANCE_REPORTS_VIEW',
  'FINANCE_REPORTS_EXPORT',
  'FINANCE_SETTINGS_MANAGE',
  'PAYROLL_VIEW',
  'PAYROLL_PREPARE',
  'PAYROLL_REVIEW',
  'PAYROLL_PROCESS',
  'PAYROLL_REVERSE',
  'PAYROLL_MANAGE',
] as const;

export type FinancePermissionCode = (typeof FINANCE_PERMISSION_CODES)[number];

export const DEFAULT_FINANCE_PERMISSIONS: FinancePermissionCode[] = [
  'FINANCE_DASHBOARD_VIEW',
  'FINANCE_INVOICES_VIEW',
  'FINANCE_INVOICES_CREATE',
  'FINANCE_PAYMENTS_VIEW',
  'FINANCE_PAYMENTS_RECORD',
  'FINANCE_RECEIPTS_PRINT',
];

export function validateFinancePermissions(
  values: string[] | undefined,
): FinancePermissionCode[] {
  if (values === undefined) return [...DEFAULT_FINANCE_PERMISSIONS];
  if (!values.length) return [];
  const uniqueValues = [...new Set(values)];
  for (const value of uniqueValues) {
    if (!FINANCE_PERMISSION_CODES.includes(value as FinancePermissionCode)) {
      throw new BadRequestException(`Unsupported finance permission: ${value}`);
    }
  }
  return uniqueValues as FinancePermissionCode[];
}
