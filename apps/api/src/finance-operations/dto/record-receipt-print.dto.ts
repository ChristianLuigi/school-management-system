import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RecordReceiptPrintDto {
  @IsUUID('all')
  schoolId: string;

  @IsIn(['A4', 'THERMAL_80MM'])
  printFormat: 'A4' | 'THERMAL_80MM';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
