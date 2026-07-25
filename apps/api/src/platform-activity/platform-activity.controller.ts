import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { ListPlatformActivityDto } from './dto/list-platform-activity.dto';
import { RecordManagedEntryDto } from './dto/record-managed-entry.dto';
import { PlatformActivityService } from './platform-activity.service';

@UseGuards(SuperAdminGuard)
@Controller('platform/activity')
export class PlatformActivityController {
  constructor(
    private readonly platformActivityService: PlatformActivityService,
  ) {}

  @Get()
  async list(@Query() query: ListPlatformActivityDto) {
    return this.platformActivityService.list(query);
  }

  @Get('summary')
  async summary() {
    return this.platformActivityService.summary();
  }

  @Post('managed-entry')
  async recordManagedEntry(@Body() body: RecordManagedEntryDto) {
    return this.platformActivityService.recordManagedEntry(body.schoolId);
  }
}
