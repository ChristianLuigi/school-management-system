import { IsUUID } from 'class-validator';

export class FindFeePlansDto {
  @IsUUID('all')
  schoolId: string;
}