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
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { GenerateReportCardDto } from './dto/generate-report-card.dto';
import { GenerateReportCardsDto } from './dto/generate-report-cards.dto';
import { ListReportCardBatchesDto } from './dto/list-report-card-batches.dto';
import { UpdateReportCardCommentsDto } from './dto/update-report-card-comments.dto';
import { PublishReportCardDto } from './dto/publish-report-card.dto';
import { ReportCardQueryDto } from './dto/report-card-query.dto';
import { ReportCardsService } from './report-cards.service';

@Controller('report-cards')
export class ReportCardsController {
  constructor(
    private readonly reportCardsService: ReportCardsService,
    private readonly internalAuthService: InternalAuthService,
  ) {}

  private async requireSession(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    return this.internalAuthService.validateSessionToken(token);
  }

  @UseGuards(SchoolMemberGuard)
  @Roles('TEACHER', 'SCHOOL_ADMIN')
  @Get()
  async findOne(@Query() query: ReportCardQueryDto) {
    return this.reportCardsService.findOne(
      query.studentId,
      query.gradingPeriodId,
    );
  }

  @UseGuards(SchoolMemberGuard)
  @Roles('TEACHER', 'SCHOOL_ADMIN')
  @Get('preview')
  async preview(@Query() query: ReportCardQueryDto) {
    return this.reportCardsService.preview(
      query.studentId,
      query.gradingPeriodId,
    );
  }

  @Get('options')
  async getAcademicOptions(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    await this.reportCardsService.assertUserCanGenerateReportCards(
      session.user_id,
      schoolId,
      platformRole,
    );

    return this.reportCardsService.getAcademicOptions(schoolId);
  }

  @Get('generation-readiness')
  async getGenerationReadiness(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
    @Query('gradingPeriodId') gradingPeriodId: string,
    @Query('sectionId') sectionId: string,
  ) {
    const session = await this.requireSession(authorization);

    await this.reportCardsService.assertUserCanGenerateReportCards(
      session.user_id,
      schoolId,
      session.platform_role,
    );

    return this.reportCardsService.getGenerationReadiness(
      schoolId,
      gradingPeriodId,
      sectionId,
    );
  }

  @Get('batches')
  async listBatches(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListReportCardBatchesDto,
  ) {
    const session = await this.requireSession(authorization);

    await this.reportCardsService.assertUserCanGenerateReportCards(
      session.user_id,
      query.schoolId,
      session.platform_role,
    );

    return this.reportCardsService.listBatches(query);
  }

  @Get('batches/:id/print')
  async getBatchPrintDetails(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const session = await this.requireSession(authorization);

    const details = await this.reportCardsService.getBatchPrintDetails(id);

    await this.reportCardsService.assertUserCanGenerateReportCards(
      session.user_id,
      details.schoolId,
      session.platform_role,
    );

    return details;
  }
  @Get('batches/:id')
  async getBatchDetails(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const session = await this.requireSession(authorization);
    const details = await this.reportCardsService.getBatchDetails(id);

    await this.reportCardsService.assertUserCanGenerateReportCards(
      session.user_id,
      details.batch.schoolId,
      session.platform_role,
    );

    return details;
  }

  @Post('batches/:id/publish')
  async publishBatch(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const session = await this.requireSession(authorization);

    return this.reportCardsService.publishBatch(
      id,
      session.user_id,
      session.platform_role,
    );
  }

  @Get('cards/:id')
  async getReportCardDetails(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    const session = await this.requireSession(authorization);
    const details = await this.reportCardsService.getReportCardDetails(id);

    await this.reportCardsService.assertUserCanGenerateReportCards(
      session.user_id,
      details.school.id,
      session.platform_role,
    );

    return details;
  }
  @Patch('cards/:id/comments')
  async updateReportCardComments(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateReportCardCommentsDto,
  ) {
    const session = await this.requireSession(authorization);

    return this.reportCardsService.updateReportCardComments(
      id,
      body,
      session.user_id,
      session.platform_role,
    );
  }
  @UseGuards(SchoolMemberGuard)
  @Roles('TEACHER', 'SCHOOL_ADMIN')
  @Post('generate')
  async generate(@Body() body: GenerateReportCardDto) {
    return this.reportCardsService.generate(
      body.studentId,
      body.gradingPeriodId,
    );
  }

  @Post('generate/section')
  async generateForSection(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: GenerateReportCardsDto,
  ) {
    const session = await this.requireSession(authorization);

    return this.reportCardsService.generateForSection(
      body,
      session.user_id,
      session.platform_role,
    );
  }

  @UseGuards(SchoolMemberGuard)
  @Roles('SCHOOL_ADMIN')
  @Post('publish')
  async publish(@Body() body: PublishReportCardDto) {
    return this.reportCardsService.publish(
      body.studentId,
      body.gradingPeriodId,
      body.publishedByUserId,
    );
  }
}
