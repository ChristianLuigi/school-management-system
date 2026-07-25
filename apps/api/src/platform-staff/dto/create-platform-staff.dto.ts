import { IsEmail, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePlatformStaffDto {
  @IsUUID('all')
  schoolId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsIn(['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'])
  role!: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';

  @IsOptional()
  @IsString()
  jobTitle?: string;
}
