import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAdmissionApplicationDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsUUID('all')
  academicYearId?: string;

  @IsOptional()
  @IsUUID('all')
  desiredGradeLevelId?: string;

  @IsOptional()
  @IsUUID('all')
  desiredSectionId?: string;

  @IsOptional()
  @IsIn([
    'PROSPECT',
    'APPLICATION_SUBMITTED',
    'DOCUMENTS_INCOMPLETE',
    'PENDING_PAYMENT',
    'PENDING_EXAM',
    'EXAM_SCHEDULED',
    'ADMITTED',
    'CONDITIONALLY_ADMITTED',
    'WAITLISTED',
    'REJECTED',
    'CONFIRMED',
    'CANCELLED',
  ])
  admissionStatus?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

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
  @IsString()
  parentFullName?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @IsOptional()
  @IsString()
  parentProfession?: string;

  @IsOptional()
  @IsString()
  parentAddress?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

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
  @IsBoolean()
  parentIdDocumentReceived?: boolean;

  @IsOptional()
  @IsBoolean()
  conductCertificateReceived?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
