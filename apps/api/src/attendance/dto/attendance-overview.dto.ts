import { IsDateString, IsUUID } from 'class-validator';

export class AttendanceOverviewDto {
  @IsUUID('all')
  schoolId: string;

  @IsDateString()
  attendanceDate: string;
}
