import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';
export class UpdateParentGuardianLinksDto {
  @IsUUID('all') schoolId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  guardianIds!: string[];
}
