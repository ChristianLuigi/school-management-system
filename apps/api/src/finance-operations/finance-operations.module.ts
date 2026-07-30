import { Module } from '@nestjs/common';
import { AccessManagementModule } from '../access-management/access-management.module';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { CashierWorkflowController } from './cashier-workflow.controller';
import { CashierWorkflowService } from './cashier-workflow.service';
import { FinanceCorrectionsController } from './finance-corrections.controller';
import { FinanceCorrectionsService } from './finance-corrections.service';
import { FinanceBillingController } from './finance-billing.controller';
import { FinanceBillingService } from './finance-billing.service';
import { FinanceOperationsController } from './finance-operations.controller';
import { FinanceOperationsService } from './finance-operations.service';
import { FinanceReconciliationController } from './finance-reconciliation.controller';
import { FinanceReconciliationService } from './finance-reconciliation.service';

@Module({
  imports: [
    AccessManagementModule,
    DbModule,
    InternalAuthModule,
    PlatformActivityModule,
  ],
  controllers: [
    FinanceOperationsController,
    CashierWorkflowController,
    FinanceCorrectionsController,
    FinanceBillingController,
    FinanceReconciliationController,
  ],
  providers: [
    FinanceOperationsService,
    CashierWorkflowService,
    FinanceCorrectionsService,
    FinanceBillingService,
    FinanceReconciliationService,
  ],
})
export class FinanceOperationsModule {}
