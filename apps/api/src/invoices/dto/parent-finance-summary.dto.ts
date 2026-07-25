import { IsUUID } from 'class-validator';

export class ParentFinanceSummaryDto {
  @IsUUID('all')
  guardianId: string;

  @IsUUID('all')
  studentId: string;
}