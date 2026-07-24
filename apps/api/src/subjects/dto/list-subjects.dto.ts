import { IsUUID } from 'class-validator';

export class ListSubjectsDto {
  @IsUUID('all')
  schoolId: string;
}