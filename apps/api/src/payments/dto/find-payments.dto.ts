import { IsUUID } from 'class-validator';

export class FindPaymentsDto {
  @IsUUID('all')
  invoiceId: string;
}