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
import { FinanceCorrectionQueryDto } from './dto/finance-correction-query.dto';
import { ProcessPaymentCorrectionDto } from './dto/process-payment-correction.dto';
import { RequestCreditNoteDto } from './dto/request-credit-note.dto';
import { RequestPaymentCorrectionDto } from './dto/request-payment-correction.dto';
import { ReviewFinanceCorrectionDto } from './dto/review-finance-correction.dto';
import { FinanceCorrectionsService } from './finance-corrections.service';

@Controller('finance')
export class FinanceCorrectionsController {
  constructor(
    private readonly financeCorrectionsService: FinanceCorrectionsService,
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

  @Get('corrections')
  async listCorrections(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: FinanceCorrectionQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      query.schoolId,
      'FINANCE_PAYMENTS_VIEW',
    );
    const [canApprove, canRequestPaymentCorrection, canRequestCreditNote] =
      await Promise.all([
        this.hasPermission(
          session,
          query.schoolId,
          'FINANCE_CORRECTIONS_APPROVE',
        ),
        this.hasPermission(
          session,
          query.schoolId,
          'FINANCE_PAYMENTS_REVERSE',
        ),
        this.hasPermission(
          session,
          query.schoolId,
          'FINANCE_CREDIT_NOTES_CREATE',
        ),
      ]);
    return {
      ...(await this.financeCorrectionsService.listCorrections(
        query.schoolId,
        query.status,
      )),
      currentUserId: session.user_id,
      capabilities: {
        canApprove,
        canRequestPaymentCorrection,
        canRequestCreditNote,
        canProcessPaymentCorrection: canRequestPaymentCorrection,
      },
    };
  }

  @Post('payments/:paymentId/corrections')
  async requestPaymentCorrection(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('paymentId') paymentId: string,
    @Body() body: RequestPaymentCorrectionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_PAYMENTS_REVERSE',
    );
    return this.financeCorrectionsService.requestPaymentCorrection(
      paymentId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
      idempotencyKey,
    );
  }

  @Post('payment-corrections/:correctionId/approve')
  async approvePaymentCorrection(
    @Headers('authorization') authorization: string | undefined,
    @Param('correctionId') correctionId: string,
    @Body() body: ReviewFinanceCorrectionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_CORRECTIONS_APPROVE',
    );
    return this.financeCorrectionsService.approvePaymentCorrection(
      correctionId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('payment-corrections/:correctionId/reject')
  async rejectPaymentCorrection(
    @Headers('authorization') authorization: string | undefined,
    @Param('correctionId') correctionId: string,
    @Body() body: ReviewFinanceCorrectionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_CORRECTIONS_APPROVE',
    );
    return this.financeCorrectionsService.rejectPaymentCorrection(
      correctionId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('payment-corrections/:correctionId/process')
  async processPaymentCorrection(
    @Headers('authorization') authorization: string | undefined,
    @Param('correctionId') correctionId: string,
    @Body() body: ProcessPaymentCorrectionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_PAYMENTS_REVERSE',
    );
    return this.financeCorrectionsService.processPaymentCorrection(
      correctionId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('invoices/:invoiceId/credit-notes')
  async requestCreditNote(
    @Headers('authorization') authorization: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('invoiceId') invoiceId: string,
    @Body() body: RequestCreditNoteDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_CREDIT_NOTES_CREATE',
    );
    return this.financeCorrectionsService.requestCreditNote(
      invoiceId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
      idempotencyKey,
    );
  }

  @Post('credit-notes/:creditNoteId/approve')
  async approveCreditNote(
    @Headers('authorization') authorization: string | undefined,
    @Param('creditNoteId') creditNoteId: string,
    @Body() body: ReviewFinanceCorrectionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_CORRECTIONS_APPROVE',
    );
    return this.financeCorrectionsService.approveCreditNote(
      creditNoteId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('credit-notes/:creditNoteId/reject')
  async rejectCreditNote(
    @Headers('authorization') authorization: string | undefined,
    @Param('creditNoteId') creditNoteId: string,
    @Body() body: ReviewFinanceCorrectionDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.assertPermission(
      session,
      body.schoolId,
      'FINANCE_CORRECTIONS_APPROVE',
    );
    return this.financeCorrectionsService.rejectCreditNote(
      creditNoteId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
}
