import { IsUUID } from 'class-validator';

export class FindInvoicesDto {
  @IsUUID('all')
  studentId: string;
}