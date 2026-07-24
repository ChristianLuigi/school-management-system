import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class BootstrapSectionDto {
  @IsString()
  code: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsInt()
  @Min(1)
  displayOrder: number;
}

class BootstrapGradeLevelDto {
  @IsString()
  schoolLevelCode: string;

  @IsString()
  code: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsInt()
  @Min(1)
  displayOrder: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BootstrapSectionDto)
  sections: BootstrapSectionDto[];
}

class BootstrapGradingPeriodDto {
  @IsString()
  code: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsInt()
  @Min(1)
  displayOrder: number;
}

export class BootstrapSchoolSetupDto {
  @IsUUID('all')
  schoolId: string;

  @IsObject()
  academicYearNameI18n: Record<string, string>;

  @IsDateString()
  academicYearStartDate: string;

  @IsDateString()
  academicYearEndDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BootstrapGradingPeriodDto)
  gradingPeriods: BootstrapGradingPeriodDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BootstrapGradeLevelDto)
  gradeLevels?: BootstrapGradeLevelDto[];
}
