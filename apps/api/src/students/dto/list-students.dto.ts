import { IsUUID } from 'class-validator';

export class ListStudentsDto {
  @IsUUID('all')
  schoolId: string;
}