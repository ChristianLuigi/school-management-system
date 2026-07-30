import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFinanceDepositDto {
  @IsUUID('all')
  schoolId: string;

  @IsUUID('all')
  bankAccountId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  cashierSessionIds: string[];

  @IsDateString({ strict: true })
  depositDate: string;

  @Type(() => Number)
  @Min(0.01)
  depositedAmount: number;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  depositReference: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  evidenceNote?: string;
}
