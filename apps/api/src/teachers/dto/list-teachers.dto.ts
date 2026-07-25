import { IsUUID } from 'class-validator';

export class ListTeachersDto {
  @IsUUID('all')
  schoolId: string;
}