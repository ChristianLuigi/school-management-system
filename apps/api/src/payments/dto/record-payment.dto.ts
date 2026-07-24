import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RecordPaymentDto {
  @IsUUID('all')
  invoiceId: string;

  @IsUUID('all')
  studentId: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn(['CASH', 'BANK_TRANSFER', 'CARD', 'MOBILE_MONEY'])
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'MOBILE_MONEY';

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsUUID('all')
  recordedByUserId: string;
}