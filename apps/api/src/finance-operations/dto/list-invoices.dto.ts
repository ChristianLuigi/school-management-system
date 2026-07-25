import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListInvoicesDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
