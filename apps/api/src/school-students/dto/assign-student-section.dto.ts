import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AssignStudentSectionDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  sectionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  activateStudent?: boolean;
}
