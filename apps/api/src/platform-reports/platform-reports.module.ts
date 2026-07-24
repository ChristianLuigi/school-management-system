import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformReportsController } from './platform-reports.controller';
import { PlatformReportsService } from './platform-reports.service';

@Module({
  imports: [DbModule],
  controllers: [PlatformReportsController],
  providers: [PlatformReportsService],
})
export class PlatformReportsModule {}
