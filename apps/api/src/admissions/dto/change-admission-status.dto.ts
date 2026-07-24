import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ChangeAdmissionStatusDto {
  @IsUUID('all')
  schoolId: string;

  @IsIn([
    'PROSPECT',
    'APPLICATION_SUBMITTED',
    'DOCUMENTS_INCOMPLETE',
    'PENDING_PAYMENT',
    'PENDING_EXAM',
    'EXAM_SCHEDULED',
    'ADMITTED',
    'CONDITIONALLY_ADMITTED',
    'WAITLISTED',
    'REJECTED',
    'CONFIRMED',
    'CONVERTED_TO_STUDENT',
    'CANCELLED',
  ])
  newStatus: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
