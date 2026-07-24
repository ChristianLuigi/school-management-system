import { Module } from '@nestjs/common';
import { AccessManagementModule } from '../access-management/access-management.module';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { ParentReportCardsController } from './parent-report-cards.controller';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService } from './report-cards.service';

@Module({
  imports: [
    AccessManagementModule,
    DbModule,
    InternalAuthModule,
    PlatformActivityModule,
  ],
  controllers: [ReportCardsController, ParentReportCardsController],
  providers: [ReportCardsService],
})
export class ReportCardsModule {}
