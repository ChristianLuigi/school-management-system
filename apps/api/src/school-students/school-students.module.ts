import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { SchoolStudentsController } from './school-students.controller';
import { SchoolStudentsService } from './school-students.service';
import { GuardianImportService } from './guardian-import.service';
import { BulkCleanupService } from './bulk-cleanup.service';
import { BulkCleanupController } from './bulk-cleanup.controller';
import { BulkPlacementService } from './bulk-placement.service';
import { BulkPlacementController } from './bulk-placement.controller';

@Module({
  imports: [DbModule, InternalAuthModule, PlatformActivityModule],
  // Static /cleanup must be registered before the existing /:id GET route.
  controllers: [
    BulkCleanupController,
    BulkPlacementController,
    SchoolStudentsController,
  ],
  providers: [
    SchoolStudentsService,
    GuardianImportService,
    BulkCleanupService,
    BulkPlacementService,
  ],
})
export class SchoolStudentsModule {}
