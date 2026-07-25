import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { PlatformSchoolsController } from './platform-schools.controller';
import { PlatformSchoolsService } from './platform-schools.service';

@Module({
  imports: [DbModule, PlatformActivityModule],
  controllers: [PlatformSchoolsController],
  providers: [PlatformSchoolsService],
})
export class PlatformSchoolsModule {}
