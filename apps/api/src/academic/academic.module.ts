import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';

@Module({
  imports: [DbModule, PlatformActivityModule],
  controllers: [AcademicController],
  providers: [AcademicService],
})
export class AcademicModule {}
