import { IsOptional, IsUUID } from 'class-validator';

export class ListSectionsDto {
  @IsUUID('all')
  academicYearId: string;

  @IsOptional()
  @IsUUID('all')
  gradeLevelId?: string;
}