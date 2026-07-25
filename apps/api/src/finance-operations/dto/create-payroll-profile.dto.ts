import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePayrollProfileDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsNumber()
  baseSalary: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  payrollActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
