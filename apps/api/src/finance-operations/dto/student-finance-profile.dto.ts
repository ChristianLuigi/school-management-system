import { IsUUID } from 'class-validator';

export class StudentFinanceProfileDto {
  @IsUUID('all')
  schoolId: string;
}
