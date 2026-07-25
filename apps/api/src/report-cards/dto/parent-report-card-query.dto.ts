import { IsUUID } from 'class-validator';

export class ParentReportCardQueryDto {
  @IsUUID('all')
  guardianId: string;

  @IsUUID('all')
  studentId: string;

  @IsUUID('all')
  gradingPeriodId: string;
}