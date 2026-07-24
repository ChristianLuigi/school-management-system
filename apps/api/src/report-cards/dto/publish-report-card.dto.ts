import { IsUUID } from 'class-validator';

export class PublishReportCardDto {
  @IsUUID('all')
  studentId: string;

  @IsUUID('all')
  gradingPeriodId: string;

  @IsUUID('all')
  publishedByUserId: string;
}