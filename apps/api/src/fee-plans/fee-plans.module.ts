import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { FeePlansController } from './fee-plans.controller';
import { FeePlansService } from './fee-plans.service';

@Module({
  imports: [DbModule],
  controllers: [FeePlansController],
  providers: [FeePlansService],
  exports: [FeePlansService],
})
export class FeePlansModule {}