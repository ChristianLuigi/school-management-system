import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsString()
  @MinLength(15)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(15)
  @MaxLength(128)
  passwordConfirmation!: string;
}