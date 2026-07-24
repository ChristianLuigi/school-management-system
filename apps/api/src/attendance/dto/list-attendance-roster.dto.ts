import { IsUUID } from 'class-validator';

export class ListAttendanceRosterDto {
  @IsUUID('all')
  sectionId: string;
}