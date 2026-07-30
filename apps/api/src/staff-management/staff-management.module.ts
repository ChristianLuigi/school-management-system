import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { StaffComplianceController } from './staff-compliance.controller';
import { StaffComplianceService } from './staff-compliance.service';
import { StaffManagementController } from './staff-management.controller';
import { StaffManagementService } from './staff-management.service';

@Module({
  imports: [DbModule, InternalAuthModule, PlatformActivityModule],
  controllers: [StaffManagementController, StaffComplianceController],
  providers: [StaffManagementService, StaffComplianceService],
  exports: [StaffManagementService, StaffComplianceService],
})
export class StaffManagementModule {}
