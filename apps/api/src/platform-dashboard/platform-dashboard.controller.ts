import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { PlatformDashboardTrendDto } from './dto/platform-dashboard-trend.dto';
import { PlatformDashboardService } from './platform-dashboard.service';

@UseGuards(SuperAdminGuard)
@Controller('platform/dashboard')
export class PlatformDashboardController {
  constructor(
    private readonly platformDashboardService: PlatformDashboardService,
  ) {}

  @Get('summary')
  async getSummary() {
    return this.platformDashboardService.getSummary();
  }

  @Get('trends')
  async getTrends(@Query() query: PlatformDashboardTrendDto) {
    return this.platformDashboardService.getTrend(query);
  }
}