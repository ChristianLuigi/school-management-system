import { IsString } from 'class-validator';

export class ResolveSchoolInvitationDto {
  @IsString()
  token: string;
}
