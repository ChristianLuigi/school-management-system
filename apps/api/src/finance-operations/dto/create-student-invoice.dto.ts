import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStudentInvoiceDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  studentId: string;

  @IsString()
  @MaxLength(200)
  invoiceTitle: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
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
  @MaxLength(2000)
  notes?: string;
}