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
import { BillingRunQueryDto } from './dto/billing-run-query.dto';
import { BillingRunRequestDto } from './dto/billing-run-request.dto';
import { CreateBillingPlanDto } from './dto/create-billing-plan.dto';
import { UpdateBillingPlanStatusDto } from './dto/update-billing-plan-status.dto';
import { FinanceBillingService } from './finance-billing.service';

@Controller('finance/billing')
export class FinanceBillingController {
  constructor(
    private readonly billing: FinanceBillingService,
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
    @Query() query: BillingRunQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_INVOICES_VIEW',
    );
    const [context, canManage] = await Promise.all([
      this.billing.getContext(query.schoolId),
      this.hasPermission(
        session,
        query.schoolId,
        'FINANCE_BILLING_MANAGE',
      ),
    ]);
    return { ...context, capabilities: { canManage } };
  }

  @Post('plans')
  async createPlan(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateBillingPlanDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_BILLING_MANAGE',
    );
    return this.billing.createPlan(
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Patch('plans/:planId/status')
  async updatePlanStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('planId', new ParseUUIDPipe()) planId: string,
    @Body() body: UpdateBillingPlanStatusDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_BILLING_MANAGE',
    );
    return this.billing.updatePlanStatus(
      planId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('preview')
  async preview(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: BillingRunRequestDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_BILLING_MANAGE',
    );
    return this.billing.preview(body);
  }

  @Get('runs')
  async listRuns(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: BillingRunQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_INVOICES_VIEW',
    );
    return this.billing.listRuns(query);
  }

  @Post('runs')
  async createRun(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: BillingRunRequestDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_BILLING_MANAGE',
    );
    return this.billing.createRun(
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
      idempotencyKey,
    );
  }

  @Get('runs/:runId')
  async getRun(
    @Headers('authorization') authorization: string | undefined,
    @Param('runId', new ParseUUIDPipe()) runId: string,
    @Query() query: BillingRunQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_INVOICES_VIEW',
    );
    return this.billing.getRun(query.schoolId, runId);
  }
}
