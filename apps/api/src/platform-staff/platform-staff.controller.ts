import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { CreatePlatformStaffDto } from './dto/create-platform-staff.dto';
import { ListPlatformStaffDto } from './dto/list-platform-staff.dto';
import { PlatformStaffService } from './platform-staff.service';

@UseGuards(SuperAdminGuard)
@Controller('platform/staff')
export class PlatformStaffController {
  constructor(private readonly platformStaffService: PlatformStaffService) {}

  @Get()
  async list(@Query() query: ListPlatformStaffDto) {
    return this.platformStaffService.list(query);
  }

  @Post()
  async create(@Body() body: CreatePlatformStaffDto) {
    return this.platformStaffService.create(body);
  }

  @Post(':membershipId/suspend')
  async suspend(@Param('membershipId') membershipId: string) {
    return this.platformStaffService.suspend(membershipId);
  }

  @Post(':membershipId/reactivate')
  async reactivate(@Param('membershipId') membershipId: string) {
    return this.platformStaffService.reactivate(membershipId);
  }

  @Post(':membershipId/reset-password')
  async resetPassword(@Param('membershipId') membershipId: string) {
    return this.platformStaffService.resetTemporaryPassword(membershipId);
  }
}
