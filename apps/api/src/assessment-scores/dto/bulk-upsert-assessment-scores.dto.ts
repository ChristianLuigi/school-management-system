import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { UpsertAssessmentScoreItemDto } from './upsert-assessment-score-item.dto';

export class BulkUpsertAssessmentScoresDto {
  @IsUUID('all')
  assessmentId: string;

  @IsUUID('all')
  enteredByUserId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertAssessmentScoreItemDto)
  scores: UpsertAssessmentScoreItemDto[];
}