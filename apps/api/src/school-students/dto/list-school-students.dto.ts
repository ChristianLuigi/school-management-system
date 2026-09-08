import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListSchoolStudentsDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
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

  @IsOptional()
  @IsUUID('all')
  gradeLevelId?: string;

  @IsOptional()
  @IsIn(['ASSIGNED', 'UNASSIGNED'])
  enrollmentState?: 'ASSIGNED' | 'UNASSIGNED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize = 25;
}
