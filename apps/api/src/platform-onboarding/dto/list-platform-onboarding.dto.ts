import { IsBooleanString, IsIn, IsOptional, IsString } from 'class-validator';

export class ListPlatformOnboardingDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'ACTIVE_SETUP', 'SUSPENDED', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ACTIVE_SETUP' | 'SUSPENDED' | 'ARCHIVED';

  @IsOptional()
  @IsIn(['SELF_MANAGED', 'SUPERADMIN_MANAGED', 'HYBRID_MANAGED'])
  managementMode?: 'SELF_MANAGED' | 'SUPERADMIN_MANAGED' | 'HYBRID_MANAGED';

  @IsOptional()
  @IsBooleanString()
  attentionOnly?: 'true' | 'false';

  @IsOptional()
  @IsString()
  search?: string;
}
