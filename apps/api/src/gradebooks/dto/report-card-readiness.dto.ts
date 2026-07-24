import { IsOptional, IsUUID } from 'class-validator';

export class ReportCardReadinessDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsUUID('all')
  gradingPeriodId?: string;
}
