import { IsArray, IsString, IsUUID } from 'class-validator';
export class UpdateFinancePermissionsDto {
  @IsUUID('all') schoolId!: string;
  @IsArray() @IsString({ each: true }) permissionCodes!: string[];
}
