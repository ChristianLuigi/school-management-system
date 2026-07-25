import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreatePlatformSchoolAdminDto } from './create-platform-school-admin.dto';

export class CreatePlatformSchoolDto {
  @IsString()
  name!: string;

  @IsIn(['fr', 'en'])
  defaultLocale!: 'fr' | 'en';

  @IsString()
  timezone!: string;

  @IsString()
  currencyCode!: string;

  @IsString()
  countryCode!: string;

  @IsOptional()
  @IsIn(['SELF_MANAGED', 'SUPERADMIN_MANAGED', 'HYBRID_MANAGED'])
  managementMode?:
    | 'SELF_MANAGED'
    | 'SUPERADMIN_MANAGED'
    | 'HYBRID_MANAGED';

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['KG', 'PRIM', 'SEC'], { each: true })
  initialLevels!: Array<'KG' | 'PRIM' | 'SEC'>;

  @ValidateNested()
  @Type(() => CreatePlatformSchoolAdminDto)
  firstAdmin!: CreatePlatformSchoolAdminDto;
}
