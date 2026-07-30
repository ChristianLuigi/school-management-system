import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class FinancePeriodActionDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}
