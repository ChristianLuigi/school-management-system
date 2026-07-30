import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateStaffDto {
  @IsUUID('all')
  schoolId: string;

  @IsInt()
  @Min(1)
  rowVersion: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredName?: string;

  @ValidateIf(
    (_object, value) =>
      value !== undefined && value !== null && value !== '',
  )
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  addressCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  addressRegion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  addressPostalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  addressCountryCode?: string;
  @IsOptional()
  @IsString()
  @MaxLength(40)
  staffCode?: string;

  @IsOptional()
  @IsIn([
    'SCHOOL_LEADERSHIP',
    'TEACHING',
    'FINANCE',
    'ADMINISTRATIVE',
    'STUDENT_SERVICES',
    'SUPPORT',
    'CONTRACTOR',
    'OTHER',
  ])
  staffCategory?: string;

  @IsOptional()
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'VOLUNTEER'])
  employmentType?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  hireDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  workLocation?: string;

  @IsOptional()
  @IsUUID('all')
  supervisorStaffAccountId?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeReason?: string;
}
