import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class CreatePayrollProfileDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  staffAccountId: string;

  @IsNumber()
  @Min(0)
  baseSalary: number;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currencyCode: string;

  @IsOptional()
  @IsBoolean()
  payrollActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}