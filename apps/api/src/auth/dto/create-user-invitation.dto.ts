import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateUserInvitationDto {
  @IsUUID('all') schoolId!: string;
  @IsEmail() email!: string;
  @IsIn(['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN', 'PARENT'])
  roleCode!: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN' | 'PARENT';
  @IsOptional() @IsIn(['fr', 'en']) locale?: 'fr' | 'en';
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsUUID('all') guardianId?: string;
  @IsOptional() @IsString() staffCode?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  financePermissionCodes?: string[];
}
