import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { PlatformStaffController } from './platform-staff.controller';
import { PlatformStaffService } from './platform-staff.service';

@Module({
  imports: [DbModule, PlatformActivityModule],
  controllers: [PlatformStaffController],
  providers: [PlatformStaffService],
})
export class PlatformStaffModule {}
