import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

@Module({
  imports: [DbModule],
  controllers: [TeachersController],
  providers: [TeachersService],
})
export class TeachersModule {}