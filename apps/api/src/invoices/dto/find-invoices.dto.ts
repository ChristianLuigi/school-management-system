import { IsUUID } from 'class-validator';

export class FindInvoicesDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  studentId: string;
}
