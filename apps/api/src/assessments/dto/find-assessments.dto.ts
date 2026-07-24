import { IsUUID } from 'class-validator';

export class FindAssessmentsDto {
  @IsUUID('all')
  gradebookId: string;
}