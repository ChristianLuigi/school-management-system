import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSchoolStudentDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  studentCode?: string;

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
  photoUrl?: string;

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
  vaccinationStatus?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  specialNeeds?: string;

  @IsOptional()
  @IsUUID('all')
  sectionId?: string;
}
