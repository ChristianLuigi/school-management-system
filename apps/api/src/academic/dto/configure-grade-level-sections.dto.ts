import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class ConfigureGradeLevelSectionsDto {
  @IsUUID('all')
  schoolId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  sectionCount: number;
}
