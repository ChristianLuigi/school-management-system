import { IsUUID } from 'class-validator';

export class InvoicePaymentsDto {
  @IsUUID('all')
  schoolId: string;
}
