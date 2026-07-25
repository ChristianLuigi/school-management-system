import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class QuickAcademicGradeDto {
  @IsBoolean()
  enabled: boolean;

  @IsIn(['KINDERGARTEN', 'PRIMARY', 'SECONDARY'])
  academicDivision: 'KINDERGARTEN' | 'PRIMARY' | 'SECONDARY';

  @IsString()
  gradeCode: string;

  @IsString()
  nameFr: string;

  @IsString()
  nameEn: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  displayOrder: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  sectionCount: number;
}

export class QuickAcademicSetupDto {
  @IsUUID('all')
  schoolId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuickAcademicGradeDto)
  grades: QuickAcademicGradeDto[];
}
