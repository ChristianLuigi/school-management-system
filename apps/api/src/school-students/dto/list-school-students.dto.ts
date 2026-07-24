import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListSchoolStudentsDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
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
  status?: string;

  @IsOptional()
  @IsUUID('all')
  sectionId?: string;
}
