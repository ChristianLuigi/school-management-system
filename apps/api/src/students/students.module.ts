import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [DbModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}