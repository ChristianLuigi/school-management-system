import { IsIn, IsUUID } from 'class-validator';

export class UpdateSchoolMembershipStatusDto {
  @IsUUID('all')
  schoolId!: string;

  @IsIn(['ACTIVE', 'SUSPENDED'])
  membershipStatus!: 'ACTIVE' | 'SUSPENDED';
}