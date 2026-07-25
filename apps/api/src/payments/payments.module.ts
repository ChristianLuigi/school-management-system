import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [DbModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}