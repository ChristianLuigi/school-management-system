import { IsUUID } from 'class-validator';

export class InvoiceActionDto {
  @IsUUID('all')
  schoolId: string;
}
