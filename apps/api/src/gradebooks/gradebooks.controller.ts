import {
  Body,
  Controller,
  ForbiddenException,
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
import { ApproveGradebookDto } from './dto/approve-gradebook.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { FindGradebookDto } from './dto/find-gradebook.dto';
import { GradebookOverviewDto } from './dto/gradebook-overview.dto';
import { GradebookReadinessDto } from './dto/gradebook-readiness.dto';
import { InitGradebookDto } from './dto/init-gradebook.dto';
import { RejectGradebookDto } from './dto/reject-gradebook.dto';
import { ReportCardReadinessDto } from './dto/report-card-readiness.dto';
import { SubmitGradebookDto } from './dto/submit-gradebook.dto';
import { SaveScoresDto } from './dto/save-scores.dto';
import { GradebooksService } from './gradebooks.service';

@UseGuards(SchoolMemberGuard)
@Roles('TEACHER', 'SCHOOL_ADMIN')
@Controller('gradebooks')
export class GradebooksController {
  constructor(
    private readonly gradebooksService: GradebooksService,
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

  private async allowedAssignmentScopes(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
  ) {
    if (this.isAdministrator(session, schoolId)) return undefined;
    return this.accessManagementService.getTeacherAssignmentScopes(
      session.user_id,
      schoolId,
    );
  }

  private assertAdministrator(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
  ) {
    if (!this.isAdministrator(session, schoolId)) {
      throw new ForbiddenException('School administrator access is required.');
    }
  }

  private async assertLegacySectionSubjectScope(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    sectionSubjectId: string,
  ) {
    const scope =
      await this.accessManagementService.getLegacySectionSubjectScope(
        sectionSubjectId,
      );
    if (!this.isAdministrator(session, scope.schoolId)) {
      await this.accessManagementService.assertTeacherLegacySubjectAssignment(
        session.user_id,
        scope,
      );
    }
    return scope;
  }

  private async assertLegacyGradebookScope(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    gradebookId: string,
  ) {
    const scope =
      await this.accessManagementService.getLegacyGradebookScope(gradebookId);
    if (!this.isAdministrator(session, scope.schoolId)) {
      await this.accessManagementService.assertTeacherLegacySubjectAssignment(
        session.user_id,
        scope,
      );
    }
    return scope;
  }
  private async assertSectionScope(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
    sectionId: string,
    subjectId?: string,
  ) {
    if (this.isAdministrator(session, schoolId)) return;
    if (subjectId) {
      await this.accessManagementService.assertTeacherSubjectAssignment(
        session.user_id,
        schoolId,
        sectionId,
        subjectId,
      );
      return;
    }
    await this.accessManagementService.assertTeacherSectionAssignment(
      session.user_id,
      schoolId,
      sectionId,
    );
  }

  private async assertAssessmentScope(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
    assessmentId: string,
  ) {
    if (this.isAdministrator(session, schoolId)) return;
    await this.accessManagementService.assertTeacherAssessmentAssignment(
      session.user_id,
      schoolId,
      assessmentId,
    );
  }
  @Get('overview')
  async getOverview(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: GradebookOverviewDto,
  ) {
    const session = await this.requireSession(authorization);

    await this.gradebooksService.assertUserCanAccessGradebooks(
      session.user_id,
      query.schoolId,
      session.platform_role,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const scopes = await this.allowedAssignmentScopes(session, query.schoolId);
    return this.gradebooksService.getOverview(
      query.schoolId,
      query.gradingPeriodId,
      scopes?.map((scope) => scope.sectionId),
      scopes?.map((scope) => scope.subjectCode),
    );
  }

  @Get('report-card-readiness')
  async getReportCardReadiness(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ReportCardReadinessDto,
  ) {
    const session = await this.requireSession(authorization);

    await this.gradebooksService.assertUserCanAccessGradebooks(
      session.user_id,
      query.schoolId,
      session.platform_role,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    const scopes = await this.allowedAssignmentScopes(session, query.schoolId);
    return this.gradebooksService.getReportCardReadiness(
      query.schoolId,
      query.gradingPeriodId,
      scopes?.map((scope) => scope.sectionId),
      scopes?.map((scope) => scope.subjectCode),
    );
  }
  @Get('context')
  async getGradebookContext(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
    @Query('sectionId') sectionId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertSectionScope(session, schoolId, sectionId);
    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.gradebooksService.getGradebookContext(
      { schoolId, sectionId },
      session.user_id,
      platformRole,
    );
  }

  @Post('assessments')
  async createAssessment(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateAssessmentDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertSectionScope(
      session,
      body.schoolId,
      body.sectionId,
      body.subjectId,
    );
    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.gradebooksService.createAssessment(
      body,
      session.user_id,
      platformRole,
    );
  }

  @Get('assessments')
  async listAssessments(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
    @Query('sectionId') sectionId: string,
    @Query('subjectId') subjectId?: string,
    @Query('subjectName') subjectName?: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertSectionScope(session, schoolId, sectionId, subjectId);
    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.gradebooksService.listAssessments(
      { schoolId, sectionId, subjectId, subjectName },
      session.user_id,
      platformRole,
    );
  }

  @Get('assessments/:assessmentId/scores')
  async getAssessmentScores(
    @Headers('authorization') authorization: string | undefined,
    @Param('assessmentId') assessmentId: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertAssessmentScope(session, schoolId, assessmentId);
    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.gradebooksService.getAssessmentScores(
      { schoolId, assessmentId },
      session.user_id,
      platformRole,
    );
  }

  @Post('scores')
  async saveScores(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SaveScoresDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertAssessmentScope(session, body.schoolId, body.assessmentId);
    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.gradebooksService.saveScores(
      body,
      session.user_id,
      platformRole,
    );
  }
  @Get('students/:studentId/report-card')
  async getStudentReportCard(
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

    return this.gradebooksService.getStudentReportCard(
      {
        schoolId,
        studentId,
      },
      session.user_id,
      platformRole,
    );
  }
  @Get(':gradebookId/readiness')
  async checkReadiness(
    @Headers('authorization') authorization: string | undefined,
    @Param('gradebookId') gradebookId: string,
  ) {
    const session = await this.requireSession(authorization);
    const readiness = await this.gradebooksService.checkReadiness(gradebookId);

    await this.gradebooksService.assertUserCanAccessGradebooks(
      session.user_id,
      readiness.schoolId,
      session.platform_role,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );
    if (!this.isAdministrator(session, readiness.schoolId)) {
      await this.assertLegacyGradebookScope(session, gradebookId);
    }

    return readiness;
  }
  @Post(':gradebookId/submit')
  async submitGradebook(
    @Headers('authorization') authorization: string | undefined,
    @Param('gradebookId') gradebookId: string,
  ) {
    const session = await this.requireSession(authorization);
    const scope = await this.assertLegacyGradebookScope(session, gradebookId);
    await this.gradebooksService.assertUserCanAccessGradebooks(
      session.user_id,
      scope.schoolId,
      session.platform_role,
      ['SCHOOL_ADMIN', 'TEACHER'],
    );

    return this.gradebooksService.submitGradebook(
      gradebookId,
      session.user_id,
      session.platform_role,
    );
  }

  @Post(':gradebookId/approve')
  async approveGradebook(
    @Headers('authorization') authorization: string | undefined,
    @Param('gradebookId') gradebookId: string,
  ) {
    const session = await this.requireSession(authorization);

    return this.gradebooksService.approveGradebook(
      gradebookId,
      session.user_id,
      session.platform_role,
    );
  }

  @Post(':gradebookId/reject')
  async rejectGradebook(
    @Headers('authorization') authorization: string | undefined,
    @Param('gradebookId') gradebookId: string,
    @Body() body: RejectGradebookDto,
  ) {
    const session = await this.requireSession(authorization);

    return this.gradebooksService.rejectGradebook(
      gradebookId,
      body.reason,
      session.user_id,
      session.platform_role,
    );
  }

  @Get()
  async findOne(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: FindGradebookDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertLegacySectionSubjectScope(session, query.sectionSubjectId);
    return this.gradebooksService.findOne(
      query.sectionSubjectId,
      query.gradingPeriodId,
    );
  }

  @Get('readiness')
  async readiness(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: GradebookReadinessDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertLegacyGradebookScope(session, query.gradebookId);
    return this.gradebooksService.getReadiness(query.gradebookId);
  }

  @Post('init')
  async init(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: InitGradebookDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertLegacySectionSubjectScope(session, body.sectionSubjectId);
    return this.gradebooksService.init(
      body.sectionSubjectId,
      body.gradingPeriodId,
    );
  }

  @Post('submit')
  async submit(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: SubmitGradebookDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertLegacyGradebookScope(session, body.gradebookId);
    return this.gradebooksService.submit(body.gradebookId, session.user_id);
  }

  @Post('approve')
  async approve(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ApproveGradebookDto,
  ) {
    const session = await this.requireSession(authorization);
    const scope = await this.accessManagementService.getLegacyGradebookScope(
      body.gradebookId,
    );
    this.assertAdministrator(session, scope.schoolId);
    return this.gradebooksService.approve(body.gradebookId, session.user_id);
  }
}
