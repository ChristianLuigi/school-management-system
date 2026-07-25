import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PlatformOnboardingController } from './platform-onboarding.controller';
import { PlatformOnboardingService } from './platform-onboarding.service';

@Module({
  imports: [DbModule],
  controllers: [PlatformOnboardingController],
  providers: [PlatformOnboardingService],
})
export class PlatformOnboardingModule {}
