import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessManagementService } from '../access-management/access-management.service';
import { CreatePayrollProfileDto } from '../finance-operations/dto/create-payroll-profile.dto';
import { CreatePayrollRunDto } from '../finance-operations/dto/create-payroll-run.dto';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { MarkPayrollItemPaidDto } from './dto/mark-payroll-item-paid.dto';
import { ReversePayrollItemPaymentDto } from './dto/reverse-payroll-item-payment.dto';
import { UpdatePayrollItemAdjustmentsDto } from './dto/update-payroll-item-adjustments.dto';
import { UpdatePayrollRunStatusDto } from './dto/update-payroll-run-status.dto';
import { FinancePayrollService } from './finance-payroll.service';

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
    return this.internalAuthService.validateSessionToken(
      authorization.slice('Bearer '.length).trim(),
    );
  }

  private async assertPermission(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
    permissionCode:
      | 'PAYROLL_VIEW'
      | 'PAYROLL_PREPARE'
      | 'PAYROLL_REVIEW'
      | 'PAYROLL_PROCESS'
      | 'PAYROLL_REVERSE'
      | 'PAYROLL_MANAGE',
  ) {
    if (
      session.platform_role === 'SUPER_ADMIN' ||
      session.school_roles.some(
        (role) =>
          role.schoolId === schoolId && role.roleCode === 'SCHOOL_ADMIN',
      )
    ) {
      return;
    }
    await this.accessManagementService.assertFinancePermission(
      session.user_id,
      schoolId,
      permissionCode,
    );
  }

  private platformRole(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
  ) {
    return session.platform_role === 'SUPER_ADMIN'
      ? ('SUPER_ADMIN' as const)
      : null;
  }

  @Get('staff-options')
  async listPayrollStaffOptions(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'PAYROLL_VIEW');
    return this.financePayrollService.listPayrollStaffOptions(
      { schoolId },
      session.user_id,
      this.platformRole(session),
    );
  }

  @Get('profiles')
  async listPayrollProfiles(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'PAYROLL_VIEW');
    return this.financePayrollService.listPayrollProfiles(
      { schoolId },
      session.user_id,
      this.platformRole(session),
    );
  }

  @Post('profiles')
  async createPayrollProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreatePayrollProfileDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.financePayrollService.createPayrollProfile(
      body,
      session.user_id,
      this.platformRole(session),
    );
  }

  @Get('runs')
  async listPayrollRuns(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'PAYROLL_VIEW');
    return this.financePayrollService.listPayrollRuns(
      { schoolId },
      session.user_id,
      this.platformRole(session),
    );
  }

  @Post('runs')
  async createPayrollRun(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreatePayrollRunDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.financePayrollService.createPayrollRun(
      body,
      session.user_id,
      this.platformRole(session),
    );
  }

  @Get('approval-inbox')
  async listPayrollApprovalInbox(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    return this.financePayrollService.listApprovalInbox(
      { schoolId },
      session.user_id,
      this.platformRole(session),
    );
  }
  @Get('runs/:runId/payment-register')
  async getPayrollPaymentRegister(
    @Headers('authorization') authorization: string | undefined,
    @Param('runId') runId: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'PAYROLL_VIEW');
    return this.financePayrollService.getPayrollPaymentRegister(
      { schoolId, payrollRunId: runId },
      session.user_id,
      this.platformRole(session),
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
    return this.financePayrollService.getPayrollRunDetails(
      { schoolId, payrollRunId: runId },
      session.user_id,
      this.platformRole(session),
    );
  }

  @Patch('runs/:runId/status')
  async updatePayrollRunStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('runId') runId: string,
    @Body() body: UpdatePayrollRunStatusDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.financePayrollService.updatePayrollRunStatus(
      runId,
      body,
      session.user_id,
      this.platformRole(session),
    );
  }

  @Put('items/:itemId/adjustments')
  async updatePayrollItemAdjustments(
    @Headers('authorization') authorization: string | undefined,
    @Param('itemId') itemId: string,
    @Body() body: UpdatePayrollItemAdjustmentsDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.financePayrollService.updatePayrollItemAdjustments(
      itemId,
      body,
      session.user_id,
      this.platformRole(session),
    );
  }

  @Patch('items/:itemId/payment')
  async markPayrollItemPaid(
    @Headers('authorization') authorization: string | undefined,
    @Param('itemId') itemId: string,
    @Body() body: MarkPayrollItemPaidDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.financePayrollService.markPayrollItemPaid(
      itemId,
      body,
      session.user_id,
      this.platformRole(session),
    );
  }

  @Post('items/:itemId/reversal')
  async reversePayrollItemPayment(
    @Headers('authorization') authorization: string | undefined,
    @Param('itemId') itemId: string,
    @Body() body: ReversePayrollItemPaymentDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.financePayrollService.reversePayrollItemPayment(
      itemId,
      body,
      session.user_id,
      this.platformRole(session),
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
    return this.financePayrollService.getPayrollPayslipDetails(
      { schoolId, payrollItemId: itemId },
      session.user_id,
      this.platformRole(session),
    );
  }
}
