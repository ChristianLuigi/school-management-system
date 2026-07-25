import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString() @MinLength(20) token!: string;
  @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  @IsString() @MinLength(15) @MaxLength(128) password!: string;
  @IsString() @MinLength(15) @MaxLength(128) passwordConfirmation!: string;
}
