import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ChangeStudentStatusDto {
  @IsUUID('all')
  schoolId: string;

  @IsIn([
    'PRE_REGISTERED',
    'REGISTERED',
    'ACTIVE',
    'SUSPENDED',
    'WITHDRAWN',
    'TRANSFERRED',
    'GRADUATED',
    'ARCHIVED',
  ])
  newStatus: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
