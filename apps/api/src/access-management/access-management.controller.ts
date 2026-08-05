import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AccessManagementService } from './access-management.service';
import { UpdateFinancePermissionsDto } from './dto/update-finance-permissions.dto';
import { UpdateParentGuardianLinksDto } from './dto/update-parent-guardian-links.dto';
import { UpdateTeacherAssignmentsDto } from './dto/update-teacher-assignments.dto';

@Controller('access-management')
export class AccessManagementController {
  constructor(
    private readonly auth: AuthService,
    private readonly access: AccessManagementService,
  ) {}

  private async session(authorization: string | undefined) {
    return this.auth.requireSession(authorization);
  }

  @Get('guardian-options')
  async guardianOptions(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId', new ParseUUIDPipe()) schoolId: string,
  ) {
    const session = await this.session(authorization);
    return this.access.listGuardianOptions(
      schoolId,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Put('teachers/staff/:staffAccountId/assignments')
  async updateTeacherStaffAssignments(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffAccountId', new ParseUUIDPipe()) staffAccountId: string,
    @Body() body: UpdateTeacherAssignmentsDto,
  ) {
    const session = await this.session(authorization);
    return this.access.updateTeacherStaffAssignments(
      staffAccountId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  /**
   * Compatibility endpoint for clients that still identify a teacher by user.
   */
  @Put('teachers/:userId/assignments')
  async updateTeacherAssignments(
    @Headers('authorization') authorization: string | undefined,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: UpdateTeacherAssignmentsDto,
  ) {
    const session = await this.session(authorization);
    return this.access.updateTeacherAssignments(
      userId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Put('finance/:userId/permissions')
  async updateFinancePermissions(
    @Headers('authorization') authorization: string | undefined,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: UpdateFinancePermissionsDto,
  ) {
    const session = await this.session(authorization);
    return this.access.updateFinancePermissions(
      userId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Put('parents/:userId/guardian-links')
  async updateParentGuardianLinks(
    @Headers('authorization') authorization: string | undefined,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: UpdateParentGuardianLinksDto,
  ) {
    const session = await this.session(authorization);
    return this.access.updateParentGuardianLinks(
      userId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
}
