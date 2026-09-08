import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateStudentGuardianDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsIn(['MOTHER', 'FATHER', 'TUTOR', 'OTHER'])
  relationship?: 'MOTHER' | 'FATHER' | 'TUTOR' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  profession?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phonePrimary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phoneSecondary?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmergencyContact?: boolean;

  @IsOptional()
  @IsBoolean()
  isAuthorizedPickup?: boolean;
}
