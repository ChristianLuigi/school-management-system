import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

import { IsIn, Matches, MaxLength } from 'class-validator';

export class UpdateSchoolBrandingDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  @MaxLength(350000)
  logoUrl?: string;

  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i)
  primaryColor?: string;

  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i)
  accentColor?: string;

  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  defaultTheme?: 'light' | 'dark' | 'system';

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  directorName?: string;

  @IsOptional()
  @IsObject()
  reportCardTitleI18n?: Record<string, string>;

  @IsOptional()
  @IsObject()
  reportCardFooterI18n?: Record<string, string>;
}
