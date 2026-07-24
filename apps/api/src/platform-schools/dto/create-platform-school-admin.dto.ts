import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePlatformSchoolAdminDto {
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
}
