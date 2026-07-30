import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessManagementService } from '../access-management/access-management.service';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { CashierWorkflowService } from './cashier-workflow.service';
import { CashierSessionQueryDto } from './dto/cashier-session-query.dto';
import { CloseCashierSessionDto } from './dto/close-cashier-session.dto';
import { OpenCashierSessionDto } from './dto/open-cashier-session.dto';
import { RecordReceiptPrintDto } from './dto/record-receipt-print.dto';
import { ReopenCashierSessionDto } from './dto/reopen-cashier-session.dto';

@Controller('finance')
export class CashierWorkflowController {
  constructor(
    private readonly cashierWorkflowService: CashierWorkflowService,
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

  private async hasPermission(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
    permissionCode: string,
  ) {
    if (
      session.platform_role === 'SUPER_ADMIN' ||
      session.school_roles.some(
        (role) =>
          role.schoolId === schoolId && role.roleCode === 'SCHOOL_ADMIN',
      )
    ) {
      return true;
    }
    return this.accessManagementService.hasFinancePermission(
      session.user_id,
      schoolId,
      permissionCode,
    );
  }

  private async assertPermission(
    session: Awaited<ReturnType<InternalAuthService['validateSessionToken']>>,
    schoolId: string,
    permissionCode: string,
  ) {
    if (await this.hasPermission(session, schoolId, permissionCode)) {
      return;
    }
    await this.accessManagementService.assertFinancePermission(
      session.user_id,
      schoolId,
      permissionCode,
    );
  }

  @Get('cashier/session')
  async getCurrentSession(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: CashierSessionQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_PAYMENTS_RECORD',
    );
    const canSupervise = await this.hasPermission(
      session,
      query.schoolId,
      'FINANCE_CASHIER_SESSIONS_SUPERVISE',
    );
    return this.cashierWorkflowService.getCurrentSession(
      query.schoolId,
      query.currencyCode,
      session.user_id,
      canSupervise,
    );
  }

  @Get('cashier/sessions')
  async listSessions(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: CashierSessionQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_PAYMENTS_RECORD',
    );
    const canSupervise = await this.hasPermission(
      session,
      query.schoolId,
      'FINANCE_CASHIER_SESSIONS_SUPERVISE',
    );
    return this.cashierWorkflowService.listSessions(
      query.schoolId,
      session.user_id,
      canSupervise,
      query.businessDate,
    );
  }

  @Post('cashier/sessions')
  async openSession(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: OpenCashierSessionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_PAYMENTS_RECORD',
    );
    return this.cashierWorkflowService.openSession(
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('cashier/sessions/:sessionId/close')
  async closeSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('sessionId') sessionId: string,
    @Body() body: CloseCashierSessionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_PAYMENTS_RECORD',
    );
    const canSupervise = await this.hasPermission(
      session,
      body.schoolId,
      'FINANCE_CASHIER_SESSIONS_SUPERVISE',
    );
    return this.cashierWorkflowService.closeSession(
      sessionId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
      canSupervise,
    );
  }

  @Post('cashier/sessions/:sessionId/reopen')
  async reopenSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('sessionId') sessionId: string,
    @Body() body: ReopenCashierSessionDto,
  ) {
    const session = await this.requireSession(authorization);
    const canSupervise = await this.hasPermission(
      session,
      body.schoolId,
      'FINANCE_CASHIER_SESSIONS_SUPERVISE',
    );
    return this.cashierWorkflowService.reopenSession(
      sessionId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
      canSupervise,
    );
  }

  @Get('payments/:paymentId/receipt-prints')
  async getReceiptPrintSummary(
    @Headers('authorization') authorization: string | undefined,
    @Param('paymentId') paymentId: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      schoolId,
      'FINANCE_RECEIPTS_PRINT',
    );
    return this.cashierWorkflowService.getReceiptPrintSummary(
      paymentId,
      schoolId,
    );
  }

  @Post('payments/:paymentId/receipt-prints')
  async recordReceiptPrint(
    @Headers('authorization') authorization: string | undefined,
    @Param('paymentId') paymentId: string,
    @Body() body: RecordReceiptPrintDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_RECEIPTS_PRINT',
    );
    return this.cashierWorkflowService.recordReceiptPrint(
      paymentId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
}
