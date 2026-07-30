import { IsUUID } from 'class-validator';

export class StaffSchoolQueryDto {
  @IsUUID('all')
  schoolId: string;
}
