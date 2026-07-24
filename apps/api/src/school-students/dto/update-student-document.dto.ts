import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateStudentDocumentDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsIn([
    'PHOTO',
    'BIRTH_CERTIFICATE',
    'VACCINATION_CARD',
    'PREVIOUS_SCHOOL_RECORD',
    'OTHER',
  ])
  documentType?:
    | 'PHOTO'
    | 'BIRTH_CERTIFICATE'
    | 'VACCINATION_CARD'
    | 'PREVIOUS_SCHOOL_RECORD'
    | 'OTHER';

  @IsOptional()
  @IsIn(['PENDING', 'VERIFIED', 'REJECTED'])
  documentStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
