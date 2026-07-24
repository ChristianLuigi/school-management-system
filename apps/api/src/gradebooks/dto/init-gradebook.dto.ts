import { IsUUID } from 'class-validator';

export class InitGradebookDto {
  @IsUUID('all')
  sectionSubjectId: string;

  @IsUUID('all')
  gradingPeriodId: string;
}