import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { StaffComplianceController } from './staff-compliance.controller';
import { StaffComplianceService } from './staff-compliance.service';
import { StaffManagementController } from './staff-management.controller';
import { StaffManagementService } from './staff-management.service';
import { StaffSelfServiceController } from './staff-self-service.controller';
import { StaffSelfServiceService } from './staff-self-service.service';

@Module({
  imports: [AuthModule, DbModule, InternalAuthModule, PlatformActivityModule],
  controllers: [
    StaffManagementController,
    StaffComplianceController,
    StaffSelfServiceController,
  ],
  providers: [
    StaffManagementService,
    StaffComplianceService,
    StaffSelfServiceService,
  ],
  exports: [
    StaffManagementService,
    StaffComplianceService,
    StaffSelfServiceService,
  ],
})
export class StaffManagementModule {}
