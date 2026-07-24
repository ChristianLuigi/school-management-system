import { IsUUID } from 'class-validator';

export class FindGradebookDto {
  @IsUUID('all')
  sectionSubjectId: string;

  @IsUUID('all')
  gradingPeriodId: string;
}