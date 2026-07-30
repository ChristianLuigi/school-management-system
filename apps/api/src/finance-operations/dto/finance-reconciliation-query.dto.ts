import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class FinanceReconciliationQueryDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsIn(['PENDING_REVIEW', 'RECONCILED', 'REJECTED'])
  status?: 'PENDING_REVIEW' | 'RECONCILED' | 'REJECTED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
