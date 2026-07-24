import { IsIn } from 'class-validator';

export class UpdateSchoolStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'ARCHIVED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
}
