import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReopenCashierSessionDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}
