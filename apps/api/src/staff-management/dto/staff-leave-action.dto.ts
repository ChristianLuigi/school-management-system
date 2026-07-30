import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class StaffLeaveActionDto {
  @IsUUID('all')
  schoolId: string;

  @IsInt()
  @Min(1)
  rowVersion: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
