import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformActivityController } from './platform-activity.controller';
import { PlatformActivityService } from './platform-activity.service';

@Module({
  imports: [DbModule],
  controllers: [PlatformActivityController],
  providers: [PlatformActivityService],
  exports: [PlatformActivityService],
})
export class PlatformActivityModule {}
