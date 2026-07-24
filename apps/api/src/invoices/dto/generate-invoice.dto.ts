import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { GenerateInvoiceLineDto } from './generate-invoice-line.dto';

export class GenerateInvoiceDto {
  @IsUUID('all')
  studentId: string;

  @IsUUID('all')
  academicYearId: string;

  @IsOptional()
  @IsUUID('all')
  gradingPeriodId?: string;

  @IsDateString()
  issueDate: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  currencyCode: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GenerateInvoiceLineDto)
  lineItems: GenerateInvoiceLineDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}