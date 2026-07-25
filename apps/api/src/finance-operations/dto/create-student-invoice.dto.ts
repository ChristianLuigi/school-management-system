import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateStudentInvoiceDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  studentId: string;

  @IsString()
  invoiceTitle: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ISSUED'])
  invoiceStatus?: 'DRAFT' | 'ISSUED';

  @IsOptional()
  @IsString()
  notes?: string;
}