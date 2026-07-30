import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreatePayrollRunDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  periodLabel: string;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currencyCode: string;

  @IsOptional()
  @IsString()
  notes?: string;
}