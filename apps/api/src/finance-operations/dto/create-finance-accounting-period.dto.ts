import {
  IsDateString,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFinanceAccountingPeriodDto {
  @IsUUID('all')
  schoolId: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/)
  periodCode: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName: string;

  @IsDateString({ strict: true })
  startDate: string;

  @IsDateString({ strict: true })
  endDate: string;
}
