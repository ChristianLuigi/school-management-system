import { IsUUID } from 'class-validator';

export class ListGuardiansDto {
  @IsUUID('all')
  schoolId: string;
}