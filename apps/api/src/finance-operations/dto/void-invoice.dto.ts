import { IsOptional, IsString, IsUUID } from 'class-validator';

export class VoidInvoiceDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
