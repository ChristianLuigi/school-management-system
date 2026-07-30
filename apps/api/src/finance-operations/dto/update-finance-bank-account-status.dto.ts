import { IsBoolean, IsUUID } from 'class-validator';

export class UpdateFinanceBankAccountStatusDto {
  @IsUUID('all')
  schoolId: string;

  @IsBoolean()
  isActive: boolean;
}
