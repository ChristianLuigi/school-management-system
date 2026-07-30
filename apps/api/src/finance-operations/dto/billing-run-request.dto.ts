import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class BillingRunRequestDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  feePlanId: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/)
  billingPeriodCode: string;

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
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  @Type(() => String)
  studentIds?: string[];
}
