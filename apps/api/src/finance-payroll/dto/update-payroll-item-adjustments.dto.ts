import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PayrollAdjustmentLineDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/)
  code: string;

  @IsString()
  @MaxLength(200)
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class UpdatePayrollItemAdjustmentsDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollAdjustmentLineDto)
  allowances: PayrollAdjustmentLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollAdjustmentLineDto)
  deductions: PayrollAdjustmentLineDto[];
}