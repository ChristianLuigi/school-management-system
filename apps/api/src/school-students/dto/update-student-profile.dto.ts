import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateStudentProfileDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE'])
  gender?: 'MALE' | 'FEMALE';

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  placeOfBirth?: string;

  @IsOptional()
  @IsString()
  previousSchoolName?: string;

  @IsOptional()
  @IsString()
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

  @IsOptional()
  @IsString()
  healthNotes?: string;

  @IsOptional()
  @IsString()
  allergyNotes?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;
}