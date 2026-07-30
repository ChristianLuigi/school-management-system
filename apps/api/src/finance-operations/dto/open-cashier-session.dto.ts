import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class OpenCashierSessionDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingCashAmount: number;

  @IsOptional()
  @IsDateString()
  businessDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
