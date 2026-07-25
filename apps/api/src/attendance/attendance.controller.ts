import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AccessManagementService } from '../access-management/access-management.service';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { AttendanceService } from './attendance.service';
import { AttendanceOverviewDto } from './dto/attendance-overview.dto';
import { GetAttendanceSessionDto } from './dto/get-attendance-session.dto';
import { ListAttendanceRecordsDto } from './dto/list-attendance-records.dto';
import { ListAttendanceRosterDto } from './dto/list-attendance-roster.dto';
import { ListAttendanceSessionsDto } from './dto/list-attendance-sessions.dto';
import { SubmitAttendanceSessionDto } from './dto/submit-attendance-session.dto';

@UseGuards(SchoolMemberGuard)
@Roles('TEACHER', 'SCHOOL_ADMIN')
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly internalAuthService: InternalAuthService,
    private readonly accessManagementService: AccessManagementService,
  ) {}

  private async requireSession(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    return this.internalAuthService.validateSessionToken(token);
  }

  private isAdministrator(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
  ) {
    return (
      session.platform_role === 'SUPER_ADMIN' ||
      session.school_roles.some(
        (role) =>
          role.schoolId === schoolId && role.roleCode === 'SCHOOL_ADMIN',
      )
    );
  }

  private async allowedSectionIds(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
  ) {
    if (this.isAdministrator(session, schoolId)) return undefined;
    return this.accessManagementService.getTeacherSectionIds(
      session.user_id,
      schoolId,
    );
  }
  private async assertSectionIdScope(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    sectionId: string,
  ) {
    const scope = await this.accessManagementService.getSectionScope(sectionId);
    await this.assertSectionScope(session, scope.schoolId, sectionId);
  }

  private async assertAttendanceSessionScope(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    attendanceSessionId: string,
  ) {
    const scope =
      await this.accessManagementService.getAttendanceSessionScope(
        attendanceSessionId,
      );
    await this.assertSectionScope(session, scope.schoolId, scope.sectionId);
  }
  private async assertSectionScope(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
    sectionId: string,
  ) {
    if (
      session.platform_role === 'SUPER_ADMIN' ||
      session.school_roles.some(
        (role) =>
          role.schoolId === schoolId && role.roleCode === 'SCHOOL_ADMIN',
      )
    )
      return;
    await this.accessManagementService.assertTeacherSectionAssignment(
      session.user_id,
      schoolId,
      sectionId,
    );
  }
  @Get('session')
  async getAttendanceSession(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: GetAttendanceSessionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertSectionScope(session, query.schoolId, query.sectionId);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.attendanceService.getAttendanceSession(
      query,
      session.user_id,
      platformRole,
    );
  }

  @Post('session/submit')
  async submitAttendanceSession(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SubmitAttendanceSessionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertSectionScope(session, body.schoolId, body.sectionId);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.attendanceService.submitAttendanceSession(
      body,
      session.user_id,
      platformRole,
    );
  }
  @Get('overview')
  async getOverview(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: AttendanceOverviewDto,
  ) {
    const session = await this.requireSession(authorization);

    await this.attendanceService.assertUserCanAccessAttendance(
      session.user_id,
      query.schoolId,
      session.platform_role,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    return this.attendanceService.getOverview(
      query.schoolId,
      query.attendanceDate,
      await this.allowedSectionIds(session, query.schoolId),
    );
  }

  @Get('dashboard')
  async getAttendanceDashboard(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
    @Query('attendanceDate') attendanceDate: string,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.attendanceService.getAttendanceDashboard(
      {
        schoolId,
        attendanceDate,
      },
      session.user_id,
      platformRole,
      await this.allowedSectionIds(session, schoolId),
    );
  }

  @Get('students/:studentId/history')
  async getStudentAttendanceHistory(
    @Headers('authorization') authorization: string | undefined,
    @Param('studentId') studentId: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);

    if (!this.isAdministrator(session, schoolId)) {
      await this.accessManagementService.assertTeacherStudentAssignment(
        session.user_id,
        schoolId,
        studentId,
      );
    }

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.attendanceService.getStudentAttendanceHistory(
      {
        schoolId,
        studentId,
      },
      session.user_id,
      platformRole,
    );
  }

  @Get('roster')
  async findRoster(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListAttendanceRosterDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertSectionIdScope(session, query.sectionId);
    return this.attendanceService.findRoster(query.sectionId);
  }

  @Get('sessions')
  async findSessions(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListAttendanceSessionsDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertSectionIdScope(session, query.sectionId);
    return this.attendanceService.findSessions(
      query.sectionId,
      query.date,
      query.slot,
    );
  }

  @Get('records')
  async findRecords(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListAttendanceRecordsDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertAttendanceSessionScope(session, query.attendanceSessionId);
    return this.attendanceService.findRecords(query.attendanceSessionId);
  }

  @Post('sessions/:attendanceSessionId/lock')
  async lockSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('attendanceSessionId') attendanceSessionId: string,
  ) {
    const session = await this.requireSession(authorization);

    return this.attendanceService.lockSession(
      attendanceSessionId,
      session.user_id,
      session.platform_role,
    );
  }

  @Post('sessions/submit')
  async submitSession(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SubmitAttendanceSessionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertSectionScope(session, body.schoolId, body.sectionId);

    return this.attendanceService.submitSession(
      body,
      session.user_id,
      session.platform_role,
    );
  }
}
