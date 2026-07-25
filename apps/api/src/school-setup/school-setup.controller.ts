import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { BootstrapSchoolSetupDto } from './dto/bootstrap-school-setup.dto';
import { SchoolSetupStatusDto } from './dto/school-setup-status.dto';
import { SchoolSetupService } from './school-setup.service';

@UseGuards(SchoolMemberGuard)
@Roles('SCHOOL_ADMIN')
@Controller('school-setup')
export class SchoolSetupController {
  constructor(private readonly schoolSetupService: SchoolSetupService) {}

  @Get('status')
  async getStatus(@Query() query: SchoolSetupStatusDto) {
    return this.schoolSetupService.getStatus(query.schoolId);
  }

  @Post('bootstrap')
  async bootstrap(@Body() body: BootstrapSchoolSetupDto) {
    return this.schoolSetupService.bootstrap(body);
  }
}
