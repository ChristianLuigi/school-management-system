import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateReportCardsDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  gradingPeriodId: string;

  @IsUUID('all')
  sectionId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
