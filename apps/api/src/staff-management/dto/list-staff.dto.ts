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

export class ListStaffDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ARCHIVED'])
  employmentStatus?: string;

  @IsOptional()
  @IsIn([
    'SCHOOL_LEADERSHIP',
    'TEACHING',
    'FINANCE',
    'ADMINISTRATIVE',
    'STUDENT_SERVICES',
    'SUPPORT',
    'CONTRACTOR',
    'OTHER',
  ])
  staffCategory?: string;

  @IsOptional()
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'VOLUNTEER'])
  employmentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsIn(['LINKED', 'UNLINKED'])
  accountLink?: 'LINKED' | 'UNLINKED';

  @IsOptional()
  @IsIn(['WITH', 'WITHOUT'])
  payrollProfile?: 'WITH' | 'WITHOUT';

  @IsOptional()
  @IsIn(['WITH', 'WITHOUT'])
  assignments?: 'WITH' | 'WITHOUT';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}
