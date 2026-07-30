import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordPaymentDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  invoiceId: string;

  @IsUUID('all')
  cashierSessionId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsIn(['CASH', 'BANK_TRANSFER', 'CHECK', 'MOBILE_MONEY', 'CARD', 'OTHER'])
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
