import { IsNumber, IsObject, IsOptional, IsUUID, Min } from 'class-validator';

export class GenerateInvoiceLineDto {
  @IsOptional()
  @IsUUID('all')
  feePlanId?: string;

  @IsObject()
  labelI18n: Record<string, string>;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}