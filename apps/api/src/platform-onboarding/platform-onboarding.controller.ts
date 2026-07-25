import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { ListPlatformOnboardingDto } from './dto/list-platform-onboarding.dto';
import { PlatformOnboardingService } from './platform-onboarding.service';

@UseGuards(SuperAdminGuard)
@Controller('platform/onboarding')
export class PlatformOnboardingController {
  constructor(
    private readonly platformOnboardingService: PlatformOnboardingService,
  ) {}

  @Get()
  async list(@Query() query: ListPlatformOnboardingDto) {
    return this.platformOnboardingService.list(query);
  }
}
