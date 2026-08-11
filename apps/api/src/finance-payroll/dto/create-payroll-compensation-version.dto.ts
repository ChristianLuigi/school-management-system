import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StandardCompensationLineDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/)
  code: string;

  @IsString()
  @MaxLength(200)
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class CreatePayrollCompensationVersionDto {
  @IsUUID('all')
  schoolId: string;

  @IsDateString({ strict: true })
  effectiveFrom: string;

  @IsIn(['SALARY', 'HOURLY', 'DAILY'])
  compensationType: 'SALARY' | 'HOURLY' | 'DAILY';

  @IsNumber()
  @Min(0)
  baseAmount: number;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currencyCode: string;

  @IsIn(['MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'])
  payFrequency: 'MONTHLY' | 'SEMI_MONTHLY' | 'BIWEEKLY' | 'WEEKLY';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StandardCompensationLineDto)
  standardAllowances: StandardCompensationLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StandardCompensationLineDto)
  standardDeductions: StandardCompensationLineDto[];

  @IsString()
  @MaxLength(1000)
  changeReason: string;
}
