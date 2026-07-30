import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffDto } from './dto/list-staff.dto';
import { RehireStaffDto } from './dto/rehire-staff.dto';
import { StaffLifecycleActionDto } from './dto/staff-lifecycle-action.dto';
import { StaffSchoolQueryDto } from './dto/staff-school-query.dto';
import { UpdateStaffMedicalDto } from './dto/update-staff-medical.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffManagementService } from './staff-management.service';

@Controller('staff-management')
export class StaffManagementController {
  constructor(
    private readonly staffManagementService: StaffManagementService,
    private readonly internalAuthService: InternalAuthService,
  ) {}

  private async requireSession(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    return this.internalAuthService.validateSessionToken(
      authorization.slice('Bearer '.length).trim(),
    );
  }

  @Get('staff')
  async listStaff(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListStaffDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.listStaff(query, session.user_id);
  }

  @Post('staff')
  async createStaff(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateStaffDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.createStaff(body, session.user_id);
  }

  @Get('staff/:staffId')
  async getStaff(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.getStaff(
      staffId,
      query.schoolId,
      session.user_id,
    );
  }

  @Patch('staff/:staffId')
  async updateStaff(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: UpdateStaffDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.updateStaff(
      staffId,
      body,
      session.user_id,
    );
  }

  @Post('staff/:staffId/activate')
  async activate(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: StaffLifecycleActionDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.activate(staffId, body, session.user_id);
  }

  @Post('staff/:staffId/leave')
  async placeOnLeave(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: StaffLifecycleActionDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.placeOnLeave(
      staffId,
      body,
      session.user_id,
    );
  }

  @Post('staff/:staffId/suspend')
  async suspend(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: StaffLifecycleActionDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.suspend(staffId, body, session.user_id);
  }

  @Post('staff/:staffId/reactivate')
  async reactivate(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: StaffLifecycleActionDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.reactivate(
      staffId,
      body,
      session.user_id,
    );
  }

  @Post('staff/:staffId/terminate')
  async terminate(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: StaffLifecycleActionDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.terminate(
      staffId,
      body,
      session.user_id,
    );
  }

  @Post('staff/:staffId/rehire')
  async rehire(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: RehireStaffDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.rehire(staffId, body, session.user_id);
  }

  @Post('staff/:staffId/archive')
  async archive(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: StaffLifecycleActionDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.archive(staffId, body, session.user_id);
  }

  @Get('staff/:staffId/history')
  async getHistory(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.getHistory(
      staffId,
      query.schoolId,
      session.user_id,
    );
  }

  @Get('staff/:staffId/access')
  async getAccessSummary(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.getAccessSummary(
      staffId,
      query.schoolId,
      session.user_id,
    );
  }

  @Get('staff/:staffId/assignments')
  async getAssignments(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.getAssignments(
      staffId,
      query.schoolId,
      session.user_id,
    );
  }

  @Get('staff/:staffId/payroll-summary')
  async getPayrollSummary(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.getPayrollSummary(
      staffId,
      query.schoolId,
      session.user_id,
    );
  }

  @Get('staff/:staffId/medical')
  async getMedical(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.getStaffMedical(
      staffId,
      query.schoolId,
      session.user_id,
    );
  }

  @Patch('staff/:staffId/medical')
  async updateMedical(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: UpdateStaffMedicalDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.updateStaffMedical(
      staffId,
      body,
      session.user_id,
    );
  }

  @Get('staff/:staffId/assignment-options')
  async getAssignmentOptions(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.getAssignmentOptions(
      staffId,
      query.schoolId,
      session.user_id,
    );
  }
  @Get('options')
  async getOptions(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffManagementService.getOptions(
      query.schoolId,
      session.user_id,
    );
  }
}
