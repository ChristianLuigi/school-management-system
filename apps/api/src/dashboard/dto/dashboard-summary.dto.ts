import { IsUUID } from 'class-validator';

export class DashboardSummaryDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  gradingPeriodId: string;
}
