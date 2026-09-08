import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
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
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  fileUrl?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  receivedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
