import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StaffLifecycleActionDto } from './staff-lifecycle-action.dto';

export class RehireStaffDto extends StaffLifecycleActionDto {
  @IsOptional()
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'VOLUNTEER'])
  employmentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  workLocation?: string;

  @IsOptional()
  @IsUUID('all')
  supervisorStaffAccountId?: string;
}
