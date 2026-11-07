import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CleanupCandidatesDto {
  @IsUUID('all') schoolId: string;
  @IsIn(['students', 'guardians']) kind: 'students' | 'guardians';
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
}
export class BulkCleanupDto {
  @IsUUID('all') schoolId: string;
  @IsIn(['students', 'guardians']) kind: 'students' | 'guardians';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsString() @MaxLength(20) confirmation?: string;
}
