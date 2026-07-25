import { IsNumber, IsObject, IsOptional, IsUUID, Min } from 'class-validator';

export class UpsertAssessmentScoreItemDto {
  @IsUUID('all')
  studentId: string;

  @IsNumber()
  @Min(0)
  rawScore: number;

  @IsOptional()
  @IsObject()
  teacherCommentI18n?: Record<string, string>;
}