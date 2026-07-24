import { Type } from 'class-transformer';
import { IsArray, IsUUID, ValidateNested } from 'class-validator';

export class TeacherAssignmentDto {
  @IsUUID('all') sectionId!: string;
  @IsUUID('all') subjectId!: string;
}

export class UpdateTeacherAssignmentsDto {
  @IsUUID('all') schoolId!: string;
  @IsUUID('all') academicYearId!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherAssignmentDto)
  assignments!: TeacherAssignmentDto[];
}
