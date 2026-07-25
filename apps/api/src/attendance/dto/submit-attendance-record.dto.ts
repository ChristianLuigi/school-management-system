import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class SubmitAttendanceRecordDto {
  @IsUUID('all')
  studentId: string;

  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

  @IsOptional()
  @IsString()
  note?: string;
}