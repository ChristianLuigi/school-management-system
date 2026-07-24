import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateFinanceSettingsDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  defaultCurrencyCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultInvoiceDueDays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledPaymentMethods?: string[];

  @IsOptional()
  @IsString()
  financeContactName?: string;

  @IsOptional()
  @IsString()
  financeContactEmail?: string;

  @IsOptional()
  @IsString()
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