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
import { AccessManagementService } from '../access-management/access-management.service';
import { CreatePayrollProfileDto } from '../finance-operations/dto/create-payroll-profile.dto';
import { CreatePayrollRunDto } from '../finance-operations/dto/create-payroll-run.dto';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { FinancePayrollService } from './finance-payroll.service';
import { MarkPayrollItemPaidDto } from './dto/mark-payroll-item-paid.dto';

@Controller('finance/payroll')
export class FinancePayrollController {
  constructor(
    private readonly financePayrollService: FinancePayrollService,
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

  private async assertPermission(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
    permissionCode: 'PAYROLL_VIEW' | 'PAYROLL_MANAGE',
  ) {
    if (
      session.platform_role === 'SUPER_ADMIN' ||
      session.school_roles.some(
        (role) =>
          role.schoolId === schoolId && role.roleCode === 'SCHOOL_ADMIN',
      )
    )
      return;
    await this.accessManagementService.assertFinancePermission(
      session.user_id,
      schoolId,
      permissionCode,
    );
  }
  @Get('profiles')
  async listPayrollProfiles(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'PAYROLL_VIEW');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financePayrollService.listPayrollProfiles(
      { schoolId },
      session.user_id,
      platformRole,
    );
  }

  @Post('profiles')
  async createPayrollProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreatePayrollProfileDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, body.schoolId, 'PAYROLL_MANAGE');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financePayrollService.createPayrollProfile(
      body,
      session.user_id,
      platformRole,
    );
  }

  @Get('runs')
  async listPayrollRuns(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'PAYROLL_VIEW');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financePayrollService.listPayrollRuns(
      { schoolId },
      session.user_id,
      platformRole,
    );
  }

  @Post('runs')
  async createPayrollRun(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreatePayrollRunDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, body.schoolId, 'PAYROLL_MANAGE');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financePayrollService.createPayrollRun(
      body,
      session.user_id,
      platformRole,
    );
  }
  @Get('runs/:runId')
  async getPayrollRunDetails(
    @Headers('authorization') authorization: string | undefined,
    @Param('runId') runId: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'PAYROLL_VIEW');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financePayrollService.getPayrollRunDetails(
      {
        schoolId,
        payrollRunId: runId,
      },
      session.user_id,
      platformRole,
    );
  }

  @Get('items/:itemId/payslip')
  async getPayrollPayslipDetails(
    @Headers('authorization') authorization: string | undefined,
    @Param('itemId') itemId: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'PAYROLL_VIEW');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financePayrollService.getPayrollPayslipDetails(
      {
        schoolId,
        payrollItemId: itemId,
      },
      session.user_id,
      platformRole,
    );
  }
  @Patch('items/:itemId/payment')
  async markPayrollItemPaid(
    @Headers('authorization') authorization: string | undefined,
    @Param('itemId') itemId: string,
    @Body() body: MarkPayrollItemPaidDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, body.schoolId, 'PAYROLL_MANAGE');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financePayrollService.markPayrollItemPaid(
      itemId,
      body,
      session.user_id,
      platformRole,
    );
  }
}
