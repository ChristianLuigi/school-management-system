import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateFinanceSettingsDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  defaultCurrencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  defaultInvoiceDueDays?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(
    ['CASH', 'BANK_TRANSFER', 'CHECK', 'MOBILE_MONEY', 'CARD', 'OTHER'],
    { each: true },
  )
  enabledPaymentMethods?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  financeContactName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  financeContactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  financeContactPhone?: string;

  @IsOptional()
  @IsObject()
  invoiceFooterI18n?: Record<string, string>;

  @IsOptional()
  @IsObject()
  receiptFooterI18n?: Record<string, string>;

  @IsOptional()
  @IsIn(['A4', 'THERMAL_80MM'])
  defaultReceiptPrintFormat?: 'A4' | 'THERMAL_80MM';

  @IsOptional()
  @IsIn(['A4', 'THERMAL_80MM'])
  defaultInvoicePrintFormat?: 'A4' | 'THERMAL_80MM';

  @IsOptional()
  @IsBoolean()
  autoOpenReceiptAfterPayment?: boolean;
}
