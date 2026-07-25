import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SectionSubjectsController } from './section-subjects.controller';
import { SectionSubjectsService } from './section-subjects.service';

@Module({
  imports: [DbModule],
  controllers: [SectionSubjectsController],
  providers: [SectionSubjectsService],
})
export class SectionSubjectsModule {}
