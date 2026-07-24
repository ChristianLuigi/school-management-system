import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  imports: [DbModule],
  controllers: [SchoolsController],
  providers: [SchoolsService],
})
export class SchoolsModule {}