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
import { CreateStaffLeaveRequestDto } from './dto/create-staff-leave-request.dto';
import { StaffLeaveActionDto } from './dto/staff-leave-action.dto';
import { StaffSchoolQueryDto } from './dto/staff-school-query.dto';
import { StaffSelfServiceService } from './staff-self-service.service';

@Controller('staff-self-service')
export class StaffSelfServiceController {
  constructor(
    private readonly staffSelfServiceService: StaffSelfServiceService,
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

  @Get('profile')
  async getProfile(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffSelfServiceService.getProfile(
      query.schoolId,
      session.user_id,
    );
  }

  @Get('documents')
  async listDocuments(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffSelfServiceService.listDocuments(
      query.schoolId,
      session.user_id,
    );
  }

  @Get('documents/:documentId/download')
  async getDocumentDownload(
    @Headers('authorization') authorization: string | undefined,
    @Param('documentId') documentId: string,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffSelfServiceService.getDocumentDownload(
      documentId,
      query.schoolId,
      session.user_id,
    );
  }

  @Get('leave-requests')
  async listLeaveRequests(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: StaffSchoolQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffSelfServiceService.listLeaveRequests(
      query.schoolId,
      session.user_id,
    );
  }

  @Post('leave-requests')
  async createLeaveRequest(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateStaffLeaveRequestDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.staffSelfServiceService.createLeaveRequest(
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
    return this.staffSelfServiceService.cancelLeaveRequest(
      leaveRequestId,
      body,
      session.user_id,
    );
  }
}
