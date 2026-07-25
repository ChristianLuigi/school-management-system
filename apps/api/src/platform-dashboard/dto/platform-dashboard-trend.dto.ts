import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class PlatformDashboardTrendDto {
  @IsIn([
    'schools_created',
    'students_created',
    'teachers_created',
    'finance_admins_created',
  ])
  metric:
    | 'schools_created'
    | 'students_created'
    | 'teachers_created'
    | 'finance_admins_created';

  @IsIn(['30d', '90d', '12m'])
  range: '30d' | '90d' | '12m';

  @IsOptional()
  @IsUUID('all')
  schoolId?: string;

  @IsOptional()
  @IsIn(['SELF_MANAGED', 'SUPERADMIN_MANAGED', 'HYBRID_MANAGED'])
  managementMode?: 'SELF_MANAGED' | 'SUPERADMIN_MANAGED' | 'HYBRID_MANAGED';
}