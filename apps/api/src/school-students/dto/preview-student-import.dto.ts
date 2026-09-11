import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PreviewStudentImportRowDto {
  @Type(() => Number)
  @IsInt()
  @Min(2)
  rowNumber: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  studentCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeOfBirth?: string;

  @IsOptional()
  @IsUUID('all')
  sectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  previousSchoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  previousSchoolAddress?: string;

  @IsOptional()
  @IsBoolean()
  photoReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  birthCertificateReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  vaccinationCardReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  previousSchoolRecordReceived?: boolean;
}

export class PreviewStudentImportDto {
  @IsUUID('all')
  schoolId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PreviewStudentImportRowDto)
  rows: PreviewStudentImportRowDto[];
}
