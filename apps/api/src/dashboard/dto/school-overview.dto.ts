import { IsUUID } from 'class-validator';

export class SchoolOverviewDto {
  @IsUUID('all')
  schoolId: string;
}
