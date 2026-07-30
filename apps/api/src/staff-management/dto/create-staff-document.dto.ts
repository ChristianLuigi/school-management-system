import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStaffDocumentDto {
  @IsUUID('all')
  schoolId: string;

  @IsIn([
    'IDENTITY',
    'CONTRACT',
    'CERTIFICATION',
    'LICENSE',
    'BACKGROUND_CHECK',
    'WORK_PERMIT',
    'OTHER',
  ])
  documentType:
    | 'IDENTITY'
    | 'CONTRACT'
    | 'CERTIFICATION'
    | 'LICENSE'
    | 'BACKGROUND_CHECK'
    | 'WORK_PERMIT'
    | 'OTHER';

  @IsString()
  @MaxLength(160)
  displayName: string;

  @IsString()
  @MaxLength(500)
  storageKey: string;

  @IsString()
  @MaxLength(255)
  originalFileName: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  fileSizeBytes: number;

  @IsOptional()
  @IsDateString({ strict: true })
  issuedOn?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  expiresOn?: string;

  @IsOptional()
  @IsIn(['STANDARD', 'RESTRICTED'])
  confidentiality?: 'STANDARD' | 'RESTRICTED';
}
