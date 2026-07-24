import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class GradebookScoreDto {
  @IsUUID('all')
  studentId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class SaveScoresDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  assessmentId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradebookScoreDto)
  scores: GradebookScoreDto[];
}
