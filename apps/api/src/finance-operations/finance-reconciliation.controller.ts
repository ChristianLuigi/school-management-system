import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessManagementService } from '../access-management/access-management.service';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { CreateFinanceAccountingPeriodDto } from './dto/create-finance-accounting-period.dto';
import { CreateFinanceBankAccountDto } from './dto/create-finance-bank-account.dto';
import { CreateFinanceDepositDto } from './dto/create-finance-deposit.dto';
import { FinancePeriodActionDto } from './dto/finance-period-action.dto';
import { FinanceReconciliationQueryDto } from './dto/finance-reconciliation-query.dto';
import { ReviewFinanceDepositDto } from './dto/review-finance-deposit.dto';
import { UpdateFinanceBankAccountStatusDto } from './dto/update-finance-bank-account-status.dto';
import { FinanceReconciliationService } from './finance-reconciliation.service';

@Controller('finance/reconciliation')
export class FinanceReconciliationController {
  constructor(
    private readonly reconciliation: FinanceReconciliationService,
    private readonly auth: InternalAuthService,
    private readonly access: AccessManagementService,
  ) {}

  private async requireSession(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    return this.auth.validateSessionToken(
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
    return this.access.hasFinancePermission(
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
    if (await this.hasPermission(session, schoolId, permissionCode)) return;
    await this.access.assertFinancePermission(
      session.user_id,
      schoolId,
      permissionCode,
    );
  }

  @Get('context')
  async getContext(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: FinanceReconciliationQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_DASHBOARD_VIEW',
    );
    const [context, canManageReconciliation, canClosePeriods] =
      await Promise.all([
        this.reconciliation.getContext(query),
        this.hasPermission(
          session,
          query.schoolId,
          'FINANCE_RECONCILIATION_MANAGE',
        ),
        this.hasPermission(
          session,
          query.schoolId,
          'FINANCE_PERIOD_CLOSE',
        ),
      ]);
    return {
      ...context,
      currentUserId: session.user_id,
      capabilities: {
        canManageReconciliation,
        canClosePeriods,
      },
    };
  }

  @Post('bank-accounts')
  async createBankAccount(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateFinanceBankAccountDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_RECONCILIATION_MANAGE',
    );
    return this.reconciliation.createBankAccount(
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Patch('bank-accounts/:bankAccountId/status')
  async updateBankAccountStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('bankAccountId', new ParseUUIDPipe()) bankAccountId: string,
    @Body() body: UpdateFinanceBankAccountStatusDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_RECONCILIATION_MANAGE',
    );
    return this.reconciliation.updateBankAccountStatus(
      bankAccountId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('deposits')
  async createDeposit(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateFinanceDepositDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_RECONCILIATION_MANAGE',
    );
    return this.reconciliation.createDeposit(
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
      idempotencyKey,
    );
  }

  @Post('deposits/:depositId/reconcile')
  async reconcileDeposit(
    @Headers('authorization') authorization: string | undefined,
    @Param('depositId', new ParseUUIDPipe()) depositId: string,
    @Body() body: ReviewFinanceDepositDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_RECONCILIATION_MANAGE',
    );
    return this.reconciliation.reconcileDeposit(
      depositId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('deposits/:depositId/reject')
  async rejectDeposit(
    @Headers('authorization') authorization: string | undefined,
    @Param('depositId', new ParseUUIDPipe()) depositId: string,
    @Body() body: ReviewFinanceDepositDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_RECONCILIATION_MANAGE',
    );
    return this.reconciliation.rejectDeposit(
      depositId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('periods')
  async createPeriod(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateFinanceAccountingPeriodDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_PERIOD_CLOSE',
    );
    return this.reconciliation.createPeriod(
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('periods/:periodId/close')
  async closePeriod(
    @Headers('authorization') authorization: string | undefined,
    @Param('periodId', new ParseUUIDPipe()) periodId: string,
    @Body() body: FinancePeriodActionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_PERIOD_CLOSE',
    );
    return this.reconciliation.closePeriod(
      periodId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('periods/:periodId/reopen')
  async reopenPeriod(
    @Headers('authorization') authorization: string | undefined,
    @Param('periodId', new ParseUUIDPipe()) periodId: string,
    @Body() body: FinancePeriodActionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_PERIOD_CLOSE',
    );
    return this.reconciliation.reopenPeriod(
      periodId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
}
