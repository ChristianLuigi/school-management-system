import { IsDateString, IsIn, IsUUID } from 'class-validator';

export class GetAttendanceSessionDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  sectionId: string;

  @IsDateString()
  attendanceDate: string;

  @IsIn(['MORNING', 'AFTERNOON'])
  slot: 'MORNING' | 'AFTERNOON';
}
