import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateStudentGuardianDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsIn(['MOTHER', 'FATHER', 'TUTOR', 'OTHER'])
  relationship?: 'MOTHER' | 'FATHER' | 'TUTOR' | 'OTHER';

  @IsOptional()
  @IsString()
  profession?: string;

  @IsOptional()
  @IsString()
  phonePrimary?: string;

  @IsOptional()
  @IsString()
  phoneSecondary?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
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
