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
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { AdmissionsService } from './admissions.service';
import { ChangeAdmissionStatusDto } from './dto/change-admission-status.dto';
import { ConvertAdmissionToStudentDto } from './dto/convert-admission-to-student.dto';
import { CreateAdmissionApplicationDto } from './dto/create-admission-application.dto';
import { ListAdmissionApplicationsDto } from './dto/list-admission-applications.dto';
import { UpdateAdmissionApplicationDto } from './dto/update-admission-application.dto';
import { UpdateAdmissionExamDto } from './dto/update-admission-exam.dto';
import { UpdateAdmissionRegistrationFeeDto } from './dto/update-admission-registration-fee.dto';

@Controller('admissions')
export class AdmissionsController {
  constructor(
    private readonly admissionsService: AdmissionsService,
    private readonly internalAuthService: InternalAuthService,
  ) {}

  private async requireSession(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    return this.internalAuthService.validateSessionToken(token);
  }

  @Get()
  async listApplications(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListAdmissionApplicationsDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.admissionsService.listApplications(
      query,
      session.user_id,
      platformRole,
    );
  }

  @Post()
  async createApplication(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateAdmissionApplicationDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.admissionsService.createApplication(
      body,
      session.user_id,
      platformRole,
    );
  }
  @Get('summary')
  async getAdmissionsSummary(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.admissionsService.getAdmissionsSummary(
      { schoolId },
      session.user_id,
      platformRole,
    );
  }
  @Get(':id')
  async getApplicationDetails(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.admissionsService.getApplicationDetails(
      {
        schoolId,
        admissionApplicationId: id,
      },
      session.user_id,
      platformRole,
    );
  }

  @Patch(':id/status')
  async changeApplicationStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: ChangeAdmissionStatusDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.admissionsService.changeApplicationStatus(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }
  @Post(':id/convert')
  async convertApplicationToStudent(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: ConvertAdmissionToStudentDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.admissionsService.convertApplicationToStudent(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }
  @Patch(':id/registration-fee')
  async updateRegistrationFee(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateAdmissionRegistrationFeeDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.admissionsService.updateRegistrationFee(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }
  @Patch(':id/exam')
  async updateAdmissionExam(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateAdmissionExamDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.admissionsService.updateAdmissionExam(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }
  @Patch(':id')
  async updateApplication(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateAdmissionApplicationDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.admissionsService.updateApplication(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }
}
