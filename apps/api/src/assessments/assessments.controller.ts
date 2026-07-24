import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { FindAssessmentsDto } from './dto/find-assessments.dto';

@UseGuards(SchoolMemberGuard)
@Roles('TEACHER', 'SCHOOL_ADMIN')
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get()
  async findAll(@Query() query: FindAssessmentsDto) {
    return this.assessmentsService.findAll(query.gradebookId);
  }

  @Post()
  async create(@Body() body: CreateAssessmentDto) {
    return this.assessmentsService.create(body);
  }
}
