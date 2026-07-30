import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class MarkPayrollItemPaidDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsIn([
    'CASH',
    'BANK_TRANSFER',
    'CHECK',
    'MOBILE_MONEY',
    'OTHER',
  ])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}