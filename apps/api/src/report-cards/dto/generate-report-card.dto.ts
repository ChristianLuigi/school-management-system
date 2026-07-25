import { IsUUID } from 'class-validator';

export class GenerateReportCardDto {
  @IsUUID('all')
  studentId: string;

  @IsUUID('all')
  gradingPeriodId: string;
}