import { IsOptional, IsUUID } from 'class-validator';

export class GradebookOverviewDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsUUID('all')
  gradingPeriodId?: string;
}
