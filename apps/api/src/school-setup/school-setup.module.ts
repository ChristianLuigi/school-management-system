import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { SchoolSetupController } from './school-setup.controller';
import { SchoolSetupService } from './school-setup.service';

@Module({
  imports: [DbModule, PlatformActivityModule],
  controllers: [SchoolSetupController],
  providers: [SchoolSetupService],
})
export class SchoolSetupModule {}
