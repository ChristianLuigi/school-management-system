import { IsUUID } from 'class-validator';

export class FinanceOverviewDto {
  @IsUUID('all')
  schoolId: string;
}
