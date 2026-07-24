import { IsUUID } from 'class-validator';

export class FindStudentDiscountsDto {
  @IsUUID('all')
  studentId: string;
}