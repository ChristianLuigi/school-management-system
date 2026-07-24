import { IsOptional, IsUUID } from 'class-validator';

export class ListEnrollmentsDto {
  @IsUUID('all')
  academicYearId: string;

  @IsOptional()
  @IsUUID('all')
  sectionId?: string;
}