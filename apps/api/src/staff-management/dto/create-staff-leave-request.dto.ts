import {
  IsDateString,
  IsIn,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStaffLeaveRequestDto {
  @IsUUID('all')
  schoolId: string;

  @IsIn([
    'ANNUAL',
    'SICK',
    'MATERNITY',
    'PATERNITY',
    'BEREAVEMENT',
    'UNPAID',
    'OTHER',
  ])
  leaveType:
    | 'ANNUAL'
    | 'SICK'
    | 'MATERNITY'
    | 'PATERNITY'
    | 'BEREAVEMENT'
    | 'UNPAID'
    | 'OTHER';

  @IsDateString({ strict: true })
  startDate: string;

  @IsDateString({ strict: true })
  endDate: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(366)
  requestedDays: number;

  @IsString()
  @MaxLength(1000)
  reason: string;
}
