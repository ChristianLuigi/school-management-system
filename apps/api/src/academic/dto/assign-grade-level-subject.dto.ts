import { IsBoolean, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class AssignGradeLevelSubjectDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  subjectId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coefficient?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
