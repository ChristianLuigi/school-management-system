import {
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateStudentDiscountDto {
  @IsUUID('all')
  studentId: string;

  @IsObject()
  nameI18n: Record<string, string>;

  @IsIn(['PERCENT', 'FIXED'])
  discountType: 'PERCENT' | 'FIXED';

  @IsNumber()
  @Min(0)
  value: number;

  @IsIn(['TUITION', 'TRANSPORT', 'ALL'])
  scope: 'TUITION' | 'TRANSPORT' | 'ALL';

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
