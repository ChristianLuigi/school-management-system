import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePlatformSchoolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['fr', 'en'])
  defaultLocale?: 'fr' | 'en';

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsIn(['SELF_MANAGED', 'SUPERADMIN_MANAGED', 'HYBRID_MANAGED'])
  managementMode?: 'SELF_MANAGED' | 'SUPERADMIN_MANAGED' | 'HYBRID_MANAGED';
}
