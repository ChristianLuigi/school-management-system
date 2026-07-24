import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateSchoolBrandingDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

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
