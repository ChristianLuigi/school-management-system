import { IsUUID } from 'class-validator';

export class ReportCardQueryDto {
  @IsUUID('all')
  studentId: string;

  @IsUUID('all')
  gradingPeriodId: string;
}