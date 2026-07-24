import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignStudentSectionDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  sectionId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}