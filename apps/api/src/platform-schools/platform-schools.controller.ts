import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { CreatePlatformSchoolDto } from './dto/create-platform-school.dto';
import { CreateSchoolStaffDto } from './dto/create-school-staff.dto';
import { UpdatePlatformSchoolDto } from './dto/update-platform-school.dto';
import { UpdateSchoolStatusDto } from './dto/update-school-status.dto';
import { PlatformSchoolsService } from './platform-schools.service';

@UseGuards(SuperAdminGuard)
@Controller('platform')
export class PlatformSchoolsController {
  constructor(
    private readonly platformSchoolsService: PlatformSchoolsService,
  ) {}

  @Get('schools')
  async findAll() {
    return this.platformSchoolsService.findAll();
  }

  @Get('schools/:id')
  async findOne(@Param('id') id: string) {
    return this.platformSchoolsService.findOne(id);
  }

  @Post('schools')
  async create(@Body() body: CreatePlatformSchoolDto) {
    return this.platformSchoolsService.create(body);
  }

  @Patch('schools/:id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdatePlatformSchoolDto,
  ) {
    return this.platformSchoolsService.update(id, body);
  }

  @Post('schools/:id/activate')
  async activate(@Param('id') id: string) {
    return this.platformSchoolsService.activate(id);
  }

  @Post('schools/:id/suspend')
  async suspend(@Param('id') id: string) {
    return this.platformSchoolsService.suspend(id);
  }

  @Post('schools/:id/archive')
  async archive(@Param('id') id: string) {
    return this.platformSchoolsService.archive(id);
  }

  @Patch('schools/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateSchoolStatusDto,
  ) {
    return this.platformSchoolsService.updateStatus(id, body.status);
  }

  @Delete('schools/:id')
  @HttpCode(204)
  async softDelete(@Param('id') id: string) {
    await this.platformSchoolsService.softDelete(id);
  }

  @Get('schools/:schoolId/staff')
  async findStaff(@Param('schoolId') schoolId: string) {
    return this.platformSchoolsService.findSchoolStaff(schoolId);
  }

  @Post('schools/:schoolId/staff')
  async createStaff(
    @Param('schoolId') schoolId: string,
    @Body() body: CreateSchoolStaffDto,
  ) {
    return this.platformSchoolsService.createSchoolStaff(schoolId, body);
  }
}
