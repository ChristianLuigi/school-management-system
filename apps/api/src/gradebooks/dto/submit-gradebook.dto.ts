import { IsUUID } from 'class-validator';

export class SubmitGradebookDto {
  @IsUUID('all')
  gradebookId: string;

  @IsUUID('all')
  submittedByUserId: string;
}