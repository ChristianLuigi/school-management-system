import { IsNumber, IsUUID, Min } from 'class-validator';

export class CloseCashierSessionDto {
  @IsUUID('all')
  schoolId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingCashAmount: number;
}
