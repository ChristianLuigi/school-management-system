import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFinanceBankAccountDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/)
  accountCode: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName: string;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currencyCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  institutionName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  accountReferenceMasked?: string;
}
