import { IsUUID } from 'class-validator';

export class ListGradeLevelsDto {
  @IsUUID('all')
  schoolId: string;
}