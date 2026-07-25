import { IsUUID } from 'class-validator';

export class ListAcademicYearsDto {
  @IsUUID('all')
  schoolId: string;
}