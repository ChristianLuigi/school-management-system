import { IsUUID } from 'class-validator';

export class SchoolSetupStatusDto {
  @IsUUID('all')
  schoolId: string;
}