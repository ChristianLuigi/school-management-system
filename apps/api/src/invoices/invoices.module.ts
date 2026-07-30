import { Module } from '@nestjs/common';
import { AccessManagementModule } from '../access-management/access-management.module';
import { DbModule } from '../db/db.module';
import { InvoicesService } from './invoices.service';
import { ParentFinanceController } from './parent-finance.controller';

@Module({
  imports: [DbModule, AccessManagementModule],
  controllers: [ParentFinanceController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}