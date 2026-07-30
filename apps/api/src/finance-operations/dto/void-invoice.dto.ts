import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class VoidInvoiceDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
