import { IsString, MinLength } from 'class-validator';

export class AcceptSchoolInvitationDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}
