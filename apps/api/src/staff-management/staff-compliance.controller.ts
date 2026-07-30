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
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { CreateStaffDocumentDto } from './dto/create-staff-document.dto';
import { CreateStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';
import { RevokeStaffDocumentDto } from './dto/revoke-staff-document.dto';
import { StaffLeaveActionDto } from './dto/staff-leave-action.dto';
import { StaffReportQueryDto } from './dto/staff-report-query.dto';
import { StaffSchoolQueryDto } from './dto/staff-school-query.dto';
import { StaffComplianceService } from './staff-compliance.service';

@Controller('staff-management')
export class StaffComplianceController {
  constructor(
    private readonly staffComplianceService: StaffComplianceService,
    private readonly internalAuthService: InternalAuthService,
  ) {}

  private async requireSession(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    return this.internalAuthService.validateSessionToken(
      authorization.slice('Bearer '.length).trim(),
    );
  }

  @Get('staff/:staffId/documents')
  async listDocuments(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.listDocuments(
      staffId,
      query.schoolId,
      session.user_id,
    );
  }

  @Post('staff/:staffId/documents')
  async createDocument(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: CreateStaffDocumentDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.createDocument(
      staffId,
      body,
      session.user_id,
    );
  }

  @Get('staff/:staffId/documents/:documentId/download')
  async getDocumentDownload(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Param('documentId') documentId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.getDocumentDownload(
      staffId,
      documentId,
      query.schoolId,
      session.user_id,
    );
  }

  @Post('staff/:staffId/documents/:documentId/revoke')
  async revokeDocument(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Param('documentId') documentId: string,
    @Body() body: RevokeStaffDocumentDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.revokeDocument(
      staffId,
      documentId,
      body,
      session.user_id,
    );
  }

  @Get('staff/:staffId/leave-requests')
  async listLeaveRequests(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.listLeaveRequests(
      staffId,
      query.schoolId,
      session.user_id,
    );
  }

  @Post('staff/:staffId/leave-requests')
  async createLeaveRequest(
    @Headers('authorization') authorization: string | undefined,
    @Param('staffId') staffId: string,
    @Body() body: CreateStaffLeaveRequestDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.createLeaveRequest(
      staffId,
      body,
      session.user_id,
    );
  }

  @Post('leave-requests/:leaveRequestId/approve')
  async approveLeaveRequest(
    @Headers('authorization') authorization: string | undefined,
    @Param('leaveRequestId') leaveRequestId: string,
    @Body() body: StaffLeaveActionDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.approveLeaveRequest(
      leaveRequestId,
      body,
      session.user_id,
    );
  }

  @Post('leave-requests/:leaveRequestId/reject')
  async rejectLeaveRequest(
    @Headers('authorization') authorization: string | undefined,
    @Param('leaveRequestId') leaveRequestId: string,
    @Body() body: StaffLeaveActionDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.rejectLeaveRequest(
      leaveRequestId,
      body,
      session.user_id,
    );
  }

  @Post('leave-requests/:leaveRequestId/cancel')
  async cancelLeaveRequest(
    @Headers('authorization') authorization: string | undefined,
    @Param('leaveRequestId') leaveRequestId: string,
    @Body() body: StaffLeaveActionDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.cancelLeaveRequest(
      leaveRequestId,
      body,
      session.user_id,
    );
  }

  @Get('reports/operational')
  async getOperationalReport(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: StaffReportQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffComplianceService.getOperationalReport(
      query,
      session.user_id,
    );
  }
}
