import { IsUUID } from 'class-validator';

export class GradebookReadinessDto {
  @IsUUID('all')
  gradebookId: string;
}