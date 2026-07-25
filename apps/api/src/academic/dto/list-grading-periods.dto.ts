import { IsUUID } from 'class-validator';

export class ListGradingPeriodsDto {
  @IsUUID('all')
  academicYearId: string;
}