import { IsUUID } from 'class-validator';

export class StudentAttendanceHistoryDto {
  @IsUUID('all')
  schoolId: string;
}
