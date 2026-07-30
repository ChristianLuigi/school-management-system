import { IsBoolean, IsUUID } from 'class-validator';

export class UpdateBillingPlanStatusDto {
  @IsUUID('all')
  schoolId: string;

  @IsBoolean()
  isActive: boolean;
}
