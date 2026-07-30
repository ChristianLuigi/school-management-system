import {
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RequestCreditNoteDto {
  @IsUUID('all')
  schoolId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}
