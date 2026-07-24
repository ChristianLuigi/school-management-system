import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';

@Module({
  imports: [DbModule],
  controllers: [SubjectsController],
  providers: [SubjectsService],
})
export class SubjectsModule {}