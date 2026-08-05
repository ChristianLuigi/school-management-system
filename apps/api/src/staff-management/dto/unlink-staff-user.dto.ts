import { IsInt, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UnlinkStaffUserDto {
  @IsUUID('all')
  schoolId: string;

  @IsInt()
  @Min(1)
  rowVersion: number;

  @IsString()
  @MaxLength(500)
  reason: string;
}
