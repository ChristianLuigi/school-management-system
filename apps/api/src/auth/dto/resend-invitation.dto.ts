import { IsUUID } from 'class-validator';

export class ResendInvitationDto {
  @IsUUID('all')
  invitationId!: string;
}
