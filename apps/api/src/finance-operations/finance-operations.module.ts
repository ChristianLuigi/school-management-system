import { Module } from '@nestjs/common';
import { AccessManagementModule } from '../access-management/access-management.module';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { FinanceOperationsController } from './finance-operations.controller';
import { FinanceOperationsService } from './finance-operations.service';

@Module({
  imports: [
    AccessManagementModule,
    DbModule,
    InternalAuthModule,
    PlatformActivityModule,
  ],
  controllers: [FinanceOperationsController],
  providers: [FinanceOperationsService],
})
export class FinanceOperationsModule {}
