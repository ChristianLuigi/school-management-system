import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class GuardianImportRowDto {
  @IsInt() @Min(2) rowNumber: number;
  @IsString() @MaxLength(80) guardianReference: string;
  @IsString() @MaxLength(100) firstName: string;
  @IsString() @MaxLength(100) lastName: string;
  @IsOptional() @IsString() @MaxLength(50) studentCode?: string;
  @IsOptional() @IsString() @MaxLength(30) relationship?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class GuardianImportDto {
  @IsUUID('all') schoolId: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => GuardianImportRowDto)
  rows: GuardianImportRowDto[];
}
