import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { SubmitAttendanceRecordDto } from './submit-attendance-record.dto';

export class SubmitAttendanceSessionDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  sectionId: string;

  @IsDateString()
  attendanceDate: string;

  @IsIn(['MORNING', 'AFTERNOON'])
  slot: 'MORNING' | 'AFTERNOON';

  @IsOptional()
  @IsUUID('all')
  takenByUserId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAttendanceRecordDto)
  records: SubmitAttendanceRecordDto[];
}
