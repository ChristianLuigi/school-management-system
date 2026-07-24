import { IsUUID } from 'class-validator';

export class RecalculateInvoiceDto {
  @IsUUID('all')
  invoiceId: string;
}