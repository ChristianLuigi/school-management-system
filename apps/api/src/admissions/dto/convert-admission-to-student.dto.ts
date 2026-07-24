import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ConvertAdmissionToStudentDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsIn(['PRE_REGISTERED', 'REGISTERED', 'ACTIVE'])
  targetStudentStatus?: 'PRE_REGISTERED' | 'REGISTERED' | 'ACTIVE';

  @IsOptional()
  @IsUUID('all')
  sectionId?: string;

  @IsOptional()
  @IsBoolean()
  createGuardian?: boolean;

  @IsOptional()
  @IsIn(['MOTHER', 'FATHER', 'TUTOR', 'OTHER'])
  guardianRelationship?: 'MOTHER' | 'FATHER' | 'TUTOR' | 'OTHER';

  @IsOptional()
  @IsString()
  conversionNote?: string;
}
