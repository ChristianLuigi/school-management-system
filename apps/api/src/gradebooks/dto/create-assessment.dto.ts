import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAssessmentDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  sectionId: string;

  @IsUUID('all')
  subjectId: string;

  @IsOptional()
  @IsString()
  subjectName?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsIn(['HOMEWORK', 'QUIZ', 'EXAM', 'PROJECT', 'PARTICIPATION', 'OTHER'])
  assessmentType?: string;

  @IsOptional()
  @IsDateString()
  assessmentDate?: string;

  @IsNumber()
  @Min(0.01)
  maxPoints: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
