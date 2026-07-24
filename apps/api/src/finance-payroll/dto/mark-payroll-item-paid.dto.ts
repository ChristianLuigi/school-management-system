import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class MarkPayrollItemPaidDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
