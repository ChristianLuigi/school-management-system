import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordStudentPaymentDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  studentId: string;

  @IsUUID('all')
  invoiceId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsIn(['CASH', 'BANK_TRANSFER', 'CHECK', 'MOBILE_MONEY', 'CARD', 'OTHER'])
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentReference?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}