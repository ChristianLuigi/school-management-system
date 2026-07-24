import { Module } from '@nestjs/common';
import { AccessManagementModule } from '../access-management/access-management.module';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { FinancePayrollController } from './finance-payroll.controller';
import { FinancePayrollService } from './finance-payroll.service';

@Module({
  imports: [
    AccessManagementModule,
    DbModule,
    InternalAuthModule,
    PlatformActivityModule,
  ],
  controllers: [FinancePayrollController],
  providers: [FinancePayrollService],
})
export class FinancePayrollModule {}
