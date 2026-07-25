import { IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateAssessmentDto {
  @IsUUID('all')
  gradebookId: string;

  @IsObject()
  titleI18n: Record<string, string>;

  @IsIn(['HOMEWORK', 'EXAM', 'QUIZ', 'PARTICIPATION', 'PROJECT'])
  assessmentType: 'HOMEWORK' | 'EXAM' | 'QUIZ' | 'PARTICIPATION' | 'PROJECT';

  @IsDateString()
  assessmentDate: string;

  @IsNumber()
  @Min(0.01)
  maxPointsPossible: number;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  weightPercent: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  displayOrder?: number;
}