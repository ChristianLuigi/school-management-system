import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateAdmissionExamDto {
  @IsUUID('all')
  schoolId: string;

  @IsOptional()
  @IsIn(['NOT_SCHEDULED', 'SCHEDULED', 'COMPLETED', 'CANCELLED'])
  examStatus?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  supervisorName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  frenchScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mathScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  englishScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  generalScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interviewScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxScore?: number;

  @IsOptional()
  @IsIn([
    'PENDING',
    'ADMITTED',
    'CONDITIONALLY_ADMITTED',
    'WAITLISTED',
    'REJECTED',
  ])
  decisionStatus?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  syncAdmissionStatus?: boolean;
}
