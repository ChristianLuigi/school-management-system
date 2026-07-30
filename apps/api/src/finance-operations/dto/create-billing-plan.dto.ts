import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBillingPlanDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  academicYearId: string;

  @IsOptional()
  @IsUUID('all')
  gradeLevelId?: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/)
  planCode: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsOptional()
  @IsObject()
  descriptionI18n?: Record<string, string>;

  @IsIn(['TUITION', 'REGISTRATION', 'TRANSPORT'])
  feeType: 'TUITION' | 'REGISTRATION' | 'TRANSPORT';

  @IsIn(['MONTHLY', 'TRIMESTER', 'ONE_TIME'])
  billingFrequency: 'MONTHLY' | 'TRIMESTER' | 'ONE_TIME';

  @Type(() => Number)
  @Min(0.01)
  defaultAmount: number;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currencyCode: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  defaultDueDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  operatorNote?: string;
}
