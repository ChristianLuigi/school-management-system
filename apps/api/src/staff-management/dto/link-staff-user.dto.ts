import { IsIn, IsInt, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class LinkStaffUserDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  userId: string;

  @IsIn(['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'])
  roleCode: 'SCHOOL_ADMIN' | 'TEACHER' | 'FINANCE_ADMIN';

  @IsInt()
  @Min(1)
  rowVersion: number;

  @IsString()
  @MaxLength(500)
  reason: string;
}
