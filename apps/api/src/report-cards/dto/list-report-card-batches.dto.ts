import { IsOptional, IsUUID } from 'class-validator';

export class ListReportCardBatchesDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsUUID('all')
  gradingPeriodId?: string;

  @IsOptional()
  @IsUUID('all')
  sectionId?: string;
}
