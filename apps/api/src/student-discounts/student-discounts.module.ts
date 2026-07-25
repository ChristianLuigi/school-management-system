import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { StudentDiscountsController } from './student-discounts.controller';
import { StudentDiscountsService } from './student-discounts.service';

@Module({
  imports: [DbModule],
  controllers: [StudentDiscountsController],
  providers: [StudentDiscountsService],
  exports: [StudentDiscountsService],
})
export class StudentDiscountsModule {}