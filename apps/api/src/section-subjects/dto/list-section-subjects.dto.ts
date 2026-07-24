import { IsOptional, IsUUID } from 'class-validator';

export class ListSectionSubjectsDto {
  @IsUUID('all')
  academicYearId: string;

  @IsOptional()
  @IsUUID('all')
  sectionId?: string;
}