import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { SchoolBrandingController } from './school-branding.controller';
import { SchoolBrandingService } from './school-branding.service';

@Module({
  imports: [DbModule, InternalAuthModule, PlatformActivityModule],
  controllers: [SchoolBrandingController],
  providers: [SchoolBrandingService],
})
export class SchoolBrandingModule {}
