import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateAdmissionRegistrationFeeDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsBoolean()
  registrationFeeRequired?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  registrationFeeAmount?: number;

  @IsOptional()
  @IsString()
  registrationFeeCurrencyCode?: string;

  @IsOptional()
  @IsIn(['NOT_REQUIRED', 'PENDING', 'PAID', 'WAIVED', 'REFUNDED'])
  registrationFeeStatus?: string;

  @IsOptional()
  @IsString()
  registrationPaymentMethod?: string;

  @IsOptional()
  @IsString()
  registrationPaymentReference?: string;

  @IsOptional()
  @IsString()
  registrationPaymentNotes?: string;
}
