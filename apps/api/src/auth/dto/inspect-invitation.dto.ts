import { IsString, MinLength } from 'class-validator';

export class InspectInvitationDto {
  @IsString()
  @MinLength(20)
  token!: string;
}
