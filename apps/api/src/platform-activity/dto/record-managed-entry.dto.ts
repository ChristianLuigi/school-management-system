import { IsUUID } from 'class-validator';

export class RecordManagedEntryDto {
  @IsUUID('all')
  schoolId!: string;
}
