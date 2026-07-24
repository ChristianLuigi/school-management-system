import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { FinanceAdminController } from './finance-admin.controller';
import { FinanceAdminService } from './finance-admin.service';

@Module({
  imports: [DbModule],
  controllers: [FinanceAdminController],
  providers: [FinanceAdminService],
})
export class FinanceAdminModule {}