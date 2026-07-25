import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { AccessManagementController } from './access-management.controller';
import { AccessManagementService } from './access-management.service';

@Module({
  imports: [AuthModule, DbModule, PlatformActivityModule],
  controllers: [AccessManagementController],
  providers: [AccessManagementService],
  exports: [AccessManagementService],
})
export class AccessManagementModule {}
