import { IsEmail, IsString } from 'class-validator';

export class LoginInternalUserDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
