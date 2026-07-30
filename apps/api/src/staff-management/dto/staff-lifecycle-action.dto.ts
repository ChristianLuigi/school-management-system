import {
  IsDateString,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class StaffLifecycleActionDto {
  @IsUUID('all')
  schoolId: string;

  @IsInt()
  @Min(1)
  rowVersion: number;

  @IsDateString({ strict: true })
  effectiveDate: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}
