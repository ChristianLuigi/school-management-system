import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class FinanceCorrectionQueryDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsIn([
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'COMPLETED',
    'APPLIED',
  ])
  status?: string;
}
