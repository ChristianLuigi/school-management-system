import { IsUUID } from 'class-validator';

export class ApproveGradebookDto {
  @IsUUID('all')
  gradebookId: string;

  @IsUUID('all')
  approvedByUserId: string;
}