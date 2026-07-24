import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePayrollRunDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  periodLabel: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
