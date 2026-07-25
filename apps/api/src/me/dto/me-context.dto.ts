import { IsOptional, IsUUID } from 'class-validator';

export class MeContextDto {
  @IsOptional()
  @IsUUID('all')
  schoolId?: string;
}