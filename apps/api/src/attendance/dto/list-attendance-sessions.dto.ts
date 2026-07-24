import { IsDateString, IsIn, IsUUID } from 'class-validator';

export class ListAttendanceSessionsDto {
  @IsUUID('all')
  sectionId: string;

  @IsDateString()
  date: string;

  @IsIn(['MORNING', 'AFTERNOON'])
  slot: 'MORNING' | 'AFTERNOON';
}