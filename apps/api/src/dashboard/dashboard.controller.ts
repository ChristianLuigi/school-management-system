import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { SchoolOverviewDto } from './dto/school-overview.dto';
import { DashboardService } from './dashboard.service';

@UseGuards(SchoolMemberGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('school-overview')
  @Roles('SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN')
  async getSchoolOverview(@Query() query: SchoolOverviewDto) {
    return this.dashboardService.getSchoolOverview(query.schoolId);
  }
  @Get('summary')
  async getSummary(@Query() query: DashboardSummaryDto) {
    return this.dashboardService.getSummary(
      query.schoolId,
      query.gradingPeriodId,
    );
  }
}
