import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const PAYROLL_RUN_STATUSES = [
  'DRAFT',
  'UNDER_REVIEW',
  'PENDING_APPROVAL',
  'REVIEWED',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'CLOSED',
] as const;

export type PayrollRunStatus = (typeof PAYROLL_RUN_STATUSES)[number];

export class UpdatePayrollRunStatusDto {
  @IsUUID('all')
  schoolId: string;

  @IsIn(PAYROLL_RUN_STATUSES)
  targetStatus: PayrollRunStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
