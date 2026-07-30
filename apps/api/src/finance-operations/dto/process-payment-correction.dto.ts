import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ProcessPaymentCorrectionDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsIn([
    'CASH',
    'BANK_TRANSFER',
    'CHECK',
    'MOBILE_MONEY',
    'CARD',
    'OTHER',
  ])
  refundMethod?:
    | 'CASH'
    | 'BANK_TRANSFER'
    | 'CHECK'
    | 'MOBILE_MONEY'
    | 'CARD'
    | 'OTHER';

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  refundReference?: string;

  @IsOptional()
  @IsUUID('all')
  cashierSessionId?: string;
}
