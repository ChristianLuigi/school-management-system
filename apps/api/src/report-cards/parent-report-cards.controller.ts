import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessManagementService } from '../access-management/access-management.service';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { ParentReportCardQueryDto } from './dto/parent-report-card-query.dto';
import { ReportCardsService } from './report-cards.service';

@Controller('parent/report-cards')
export class ParentReportCardsController {
  constructor(
    private readonly reportCardsService: ReportCardsService,
    private readonly internalAuthService: InternalAuthService,
    private readonly accessManagementService: AccessManagementService,
  ) {}

  private async requireSession(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException('Missing bearer token.');
    return this.internalAuthService.validateSessionToken(
      authorization.slice('Bearer '.length).trim(),
    );
  }

  @Get()
  async findPublished(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ParentReportCardQueryDto,
  ) {
    const session = await this.requireSession(authorization);
    await this.accessManagementService.assertParentGuardianStudent(
      session.user_id,
      query.guardianId,
      query.studentId,
    );
    return this.reportCardsService.findPublishedForGuardian(
      query.guardianId,
      query.studentId,
      query.gradingPeriodId,
    );
  }
}
