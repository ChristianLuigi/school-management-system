import { BadRequestException } from '@nestjs/common';

export const FINANCE_PERMISSION_CODES = [
  'FINANCE_DASHBOARD_VIEW',
  'FINANCE_INVOICES_VIEW',
  'FINANCE_INVOICES_CREATE',
  'FINANCE_INVOICES_EDIT',
  'FINANCE_PAYMENTS_VIEW',
  'FINANCE_PAYMENTS_RECORD',
  'FINANCE_RECEIPTS_PRINT',
  'FINANCE_REPORTS_VIEW',
  'PAYROLL_VIEW',
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
  if (!values?.length) return [...DEFAULT_FINANCE_PERMISSIONS];
  const uniqueValues = [...new Set(values)];
  for (const value of uniqueValues) {
    if (!FINANCE_PERMISSION_CODES.includes(value as FinancePermissionCode)) {
      throw new BadRequestException(`Unsupported finance permission: ${value}`);
    }
  }
  return uniqueValues as FinancePermissionCode[];
}
