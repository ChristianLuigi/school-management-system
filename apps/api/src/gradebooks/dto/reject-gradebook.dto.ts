import { IsString, MinLength } from 'class-validator';

export class RejectGradebookDto {
  @IsString()
  @MinLength(3)
  reason: string;
}
