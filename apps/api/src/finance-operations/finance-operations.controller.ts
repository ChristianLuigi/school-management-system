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
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { FinanceOverviewDto } from './dto/finance-overview.dto';
import { InvoiceActionDto } from './dto/invoice-action.dto';
import { InvoicePaymentsDto } from './dto/invoice-payments.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { StudentFinanceProfileDto } from './dto/student-finance-profile.dto';
import { UpdateFinanceSettingsDto } from './dto/update-finance-settings.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { FinanceOperationsService } from './finance-operations.service';

@Controller('finance')
export class FinanceOperationsController {
  constructor(
    private readonly financeOperationsService: FinanceOperationsService,
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
    permissionCode: string,
  ) {
    if (await this.hasPermission(session, schoolId, permissionCode)) return;
    await this.accessManagementService.assertFinancePermission(
      session.user_id,
      schoolId,
      permissionCode,
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
    )
      return true;
    return this.accessManagementService.hasFinancePermission(
      session.user_id,
      schoolId,
      permissionCode,
    );
  }
  @Get('settings')
  async getFinanceSettings(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'FINANCE_DASHBOARD_VIEW');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    const settings = await this.financeOperationsService.getFinanceSettings(
      schoolId,
      session.user_id,
      platformRole,
    );
    const canManage = await this.hasPermission(
      session,
      schoolId,
      'FINANCE_SETTINGS_MANAGE',
    );
    return { ...settings, canManage };
  }

  @Patch('settings')
  async updateFinanceSettings(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: UpdateFinanceSettingsDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_SETTINGS_MANAGE',
    );

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.updateFinanceSettings(
      body,
      session.user_id,
      platformRole,
    );
  }

  @Get('dashboard')
  async getFinanceDashboard(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'FINANCE_DASHBOARD_VIEW');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.getFinanceDashboard(
      { schoolId },
      session.user_id,
      platformRole,
    );
  }
  @Get('overview')
  async getOverview(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: FinanceOverviewDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_DASHBOARD_VIEW',
    );

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    await this.financeOperationsService.assertUserCanAccessFinance(
      session.user_id,
      query.schoolId,
      platformRole,
    );

    const [overview, canCreateInvoices, canRecordPayments, canManageSettings] =
      await Promise.all([
        this.financeOperationsService.getOverview(query.schoolId),
        this.hasPermission(
          session,
          query.schoolId,
          'FINANCE_INVOICES_CREATE',
        ),
        this.hasPermission(
          session,
          query.schoolId,
          'FINANCE_PAYMENTS_RECORD',
        ),
        this.hasPermission(
          session,
          query.schoolId,
          'FINANCE_SETTINGS_MANAGE',
        ),
      ]);
    return {
      ...overview,
      capabilities: {
        canCreateInvoices,
        canRecordPayments,
        canManageSettings,
      },
    };
  }

  @Get('invoices')
  async listInvoices(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListInvoicesDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_INVOICES_VIEW',
    );

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    await this.financeOperationsService.assertUserCanAccessFinance(
      session.user_id,
      query.schoolId,
      platformRole,
    );

    return this.financeOperationsService.listInvoices(query);
  }

  @Post('invoices')
  async createInvoice(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateInvoiceDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_INVOICES_CREATE',
    );

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.createInvoice(
      body,
      session.user_id,
      platformRole,
      idempotencyKey,
    );
  }
  @Post('payments')
  async recordPayment(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: RecordPaymentDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_PAYMENTS_RECORD',
    );

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.recordPayment(
      body,
      session.user_id,
      platformRole,
      idempotencyKey,
    );
  }
  @Get('students/search')
  async searchStudentsForFinance(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
    @Query('search') search: string | undefined,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'FINANCE_INVOICES_VIEW');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.searchStudentsForFinance(
      {
        schoolId,
        search,
      },
      session.user_id,
      platformRole,
    );
  }

  @Get('students/:studentId/summary')
  async getStudentFinanceSummary(
    @Headers('authorization') authorization: string | undefined,
    @Param('studentId') studentId: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'FINANCE_INVOICES_VIEW');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.getStudentFinanceSummary(
      {
        schoolId,
        studentId,
      },
      session.user_id,
      platformRole,
    );
  }
  @Get('students/:studentId/profile')
  async getStudentFinanceProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param('studentId') studentId: string,
    @Query() query: StudentFinanceProfileDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_INVOICES_VIEW',
    );

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.getStudentFinanceProfile(
      {
        schoolId: query.schoolId,
        studentId,
      },
      session.user_id,
      platformRole,
    );
  }

  @Get('payments/:paymentId')
  async getPaymentReceiptDetails(
    @Headers('authorization') authorization: string | undefined,
    @Param('paymentId') paymentId: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'FINANCE_RECEIPTS_PRINT');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;
    const [receipt, canRequestCorrection] = await Promise.all([
      this.financeOperationsService.getPaymentReceiptDetails(
        {
          schoolId,
          paymentId,
        },
        session.user_id,
        platformRole,
      ),
      this.hasPermission(session, schoolId, 'FINANCE_PAYMENTS_REVERSE'),
    ]);
    return {
      ...receipt,
      capabilities: { canRequestCorrection },
    };
  }
  @Get('payments/:id/receipt')
  async getPaymentReceipt(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'FINANCE_RECEIPTS_PRINT');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;
    const [receipt, canRequestCorrection] = await Promise.all([
      this.financeOperationsService.getPaymentReceipt(
        {
          schoolId,
          paymentId: id,
        },
        session.user_id,
        platformRole,
      ),
      this.hasPermission(session, schoolId, 'FINANCE_PAYMENTS_REVERSE'),
    ]);
    return {
      ...receipt,
      capabilities: { canRequestCorrection },
    };
  }
  @Post('invoices/:id/issue')
  async issueInvoice(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: InvoiceActionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_INVOICES_EDIT',
    );

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.issueInvoice(
      {
        schoolId: body.schoolId,
        invoiceId: id,
      },
      session.user_id,
      platformRole,
    );
  }

  @Post('invoices/:id/void')
  async voidInvoice(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: VoidInvoiceDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_INVOICES_VOID',
    );

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.voidInvoice(
      {
        schoolId: body.schoolId,
        invoiceId: id,
        reason: body.reason,
      },
      session.user_id,
      platformRole,
    );
  }

  @Get('invoices/:id')
  async getInvoiceDetails(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(session, schoolId, 'FINANCE_INVOICES_VIEW');

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    const invoice = await this.financeOperationsService.getInvoiceDetails(
      {
        schoolId,
        invoiceId: id,
      },
      session.user_id,
      platformRole,
    );
    const [canIssue, canVoid, canRequestCreditNote] = await Promise.all([
      this.hasPermission(session, schoolId, 'FINANCE_INVOICES_EDIT'),
      this.hasPermission(session, schoolId, 'FINANCE_INVOICES_VOID'),
      this.hasPermission(session, schoolId, 'FINANCE_CREDIT_NOTES_CREATE'),
    ]);
    return {
      ...invoice,
      capabilities: {
        canIssue,
        canVoid,
        canRequestCreditNote,
      },
    };
  }
  @Get('invoices/:id/payments')
  async listInvoicePayments(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Query() query: InvoicePaymentsDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_PAYMENTS_VIEW',
    );

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.financeOperationsService.listInvoicePayments(
      {
        schoolId: query.schoolId,
        invoiceId: id,
      },
      session.user_id,
      platformRole,
    );
  }
}
