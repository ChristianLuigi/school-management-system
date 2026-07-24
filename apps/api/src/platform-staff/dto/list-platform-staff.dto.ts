import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListPlatformStaffDto {
  @IsOptional()
  @IsUUID('all')
  schoolId?: string;

  @IsOptional()
  @IsIn(['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'])
  role?: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'INVITED', 'REMOVED'])
  status?: 'ACTIVE' | 'SUSPENDED' | 'INVITED' | 'REMOVED';

  @IsOptional()
  @IsString()
  search?: string;
}
