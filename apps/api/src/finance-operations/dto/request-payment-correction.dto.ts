import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RequestPaymentCorrectionDto {
  @IsUUID('all')
  schoolId: string;

  @IsIn(['REVERSAL', 'REFUND'])
  correctionType: 'REVERSAL' | 'REFUND';

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}
