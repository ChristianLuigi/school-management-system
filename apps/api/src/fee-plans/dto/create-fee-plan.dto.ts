import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateFeePlanDto {
  @IsUUID('all')
  schoolId: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsIn(['TUITION', 'REGISTRATION', 'TRANSPORT'])
  feeType: 'TUITION' | 'REGISTRATION' | 'TRANSPORT';

  @IsIn(['MONTHLY', 'TRIMESTER', 'ONE_TIME'])
  billingFrequency: 'MONTHLY' | 'TRIMESTER' | 'ONE_TIME';

  @IsOptional()
  @IsUUID('all')
  gradeLevelId?: string;

  @IsNumber()
  @Min(0)
  defaultAmount: number;

  @IsString()
  @Length(3, 3)
  currencyCode: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}