import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { PlatformReportsService } from './platform-reports.service';

@UseGuards(SuperAdminGuard)
@Controller('platform/reports')
export class PlatformReportsController {
  constructor(
    private readonly platformReportsService: PlatformReportsService,
  ) {}

  @Get('schools')
  async schools(@Res() res: Response) {
    const csv = await this.platformReportsService.exportSchoolsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="platform_schools.csv"',
    );
    res.send(csv);
  }

  @Get('onboarding')
  async onboarding(@Res() res: Response) {
    const csv = await this.platformReportsService.exportOnboardingCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="platform_onboarding.csv"',
    );
    res.send(csv);
  }

  @Get('staff')
  async staff(@Res() res: Response) {
    const csv = await this.platformReportsService.exportStaffCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="platform_staff.csv"',
    );
    res.send(csv);
  }

  @Get('activity')
  async activity(@Res() res: Response) {
    const csv = await this.platformReportsService.exportActivityCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="platform_activity.csv"',
    );
    res.send(csv);
  }
}
