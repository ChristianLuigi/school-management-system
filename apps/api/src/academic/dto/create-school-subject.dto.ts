import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSchoolSubjectDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  code: string;

  @IsString()
  nameFr: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
