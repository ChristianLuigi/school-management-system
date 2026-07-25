import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { AssessmentScoresService } from './assessment-scores.service';
import { BulkUpsertAssessmentScoresDto } from './dto/bulk-upsert-assessment-scores.dto';
import { FindAssessmentScoresDto } from './dto/find-assessment-scores.dto';

@UseGuards(SchoolMemberGuard)
@Roles('TEACHER', 'SCHOOL_ADMIN')
@Controller('assessment-scores')
export class AssessmentScoresController {
  constructor(
    private readonly assessmentScoresService: AssessmentScoresService,
  ) {}

  @Get()
  async findAll(@Query() query: FindAssessmentScoresDto) {
    return this.assessmentScoresService.findAll(query.assessmentId);
  }

  @Post('bulk-upsert')
  async bulkUpsert(@Body() body: BulkUpsertAssessmentScoresDto) {
    return this.assessmentScoresService.bulkUpsert(body);
  }
}
