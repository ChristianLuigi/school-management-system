import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';

@Module({
  imports: [DbModule, InternalAuthModule, PlatformActivityModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
})
export class AdmissionsModule {}
