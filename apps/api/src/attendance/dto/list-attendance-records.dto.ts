import { IsUUID } from 'class-validator';

export class ListAttendanceRecordsDto {
  @IsUUID('all')
  attendanceSessionId: string;
}