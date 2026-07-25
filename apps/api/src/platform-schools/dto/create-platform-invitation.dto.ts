import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePlatformInvitationDto {
  @IsUUID('all')
  schoolId: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsIn(['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'])
  role: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';

  @IsOptional()
  @IsUUID('all')
  invitedByUserId?: string;
}
