import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CashierSessionQueryDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsDateString()
  businessDate?: string;
}
