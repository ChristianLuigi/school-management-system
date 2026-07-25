import { IsUUID } from 'class-validator';

export class FindAssessmentScoresDto {
  @IsUUID('all')
  assessmentId: string;
}