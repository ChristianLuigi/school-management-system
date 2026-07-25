import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSchoolStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  temporaryPassword!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsIn(['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'])
  role!: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';
}
