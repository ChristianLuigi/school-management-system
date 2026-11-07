import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
export class BulkPlacementDto {
  @IsUUID('all') schoolId: string;
  @IsUUID('all') academicYearId: string;
  @IsUUID('all') sectionId: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  studentIds: string[];
  @IsOptional() @IsBoolean() activateStudent?: boolean;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsBoolean() confirmed?: boolean;
}
