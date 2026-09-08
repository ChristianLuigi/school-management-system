import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSchoolStudentDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  studentCode?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE'])
  gender?: 'MALE' | 'FEMALE';

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  photoUrl?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vaccinationStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allergies?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specialNeeds?: string;

  @IsOptional()
  @IsUUID('all')
  sectionId?: string;
}
