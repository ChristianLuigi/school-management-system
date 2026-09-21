import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStaffAccountInvitationDto {
  @IsUUID('all')
  schoolId: string;

  @IsIn(['SCHOOL_ADMIN', 'ADMIN_STAFF', 'TEACHER', 'FINANCE_ADMIN'])
  roleCode: 'SCHOOL_ADMIN' | 'ADMIN_STAFF' | 'TEACHER' | 'FINANCE_ADMIN';

  @IsOptional()
  @IsIn(['fr', 'en'])
  locale?: 'fr' | 'en';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  financePermissionCodes?: string[];
}
