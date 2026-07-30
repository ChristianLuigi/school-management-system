import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateStaffMedicalDto {
  @IsUUID('all')
  schoolId: string;

  @IsInt()
  @Min(0)
  rowVersion: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactRelationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allergiesOrConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  accommodationNotes?: string;
}