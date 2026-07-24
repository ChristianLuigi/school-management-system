import { IsUUID } from 'class-validator';

export class FindOverdueInvoicesDto {
  @IsUUID('all')
  schoolId: string;
}