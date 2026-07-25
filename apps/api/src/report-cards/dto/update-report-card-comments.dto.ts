import { IsOptional, IsString } from 'class-validator';

export class UpdateReportCardCommentsDto {
  @IsOptional()
  @IsString()
  conductNote?: string;

  @IsOptional()
  @IsString()
  teacherComment?: string;

  @IsOptional()
  @IsString()
  directorComment?: string;

  @IsOptional()
  @IsString()
  finalDecisionOverride?: string;

  @IsOptional()
  @IsString()
  finalRemarks?: string;
}
