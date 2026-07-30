import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReviewFinanceCorrectionDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reviewNote?: string;
}
