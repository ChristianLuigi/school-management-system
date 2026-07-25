import { Module } from '@nestjs/common';
import { AccessManagementModule } from '../access-management/access-management.module';
import { DbModule } from '../db/db.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { ParentFinanceController } from './parent-finance.controller';

@Module({
  imports: [DbModule, AccessManagementModule],
  controllers: [InvoicesController, ParentFinanceController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}