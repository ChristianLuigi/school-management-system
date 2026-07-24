import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { ListEnrollmentsDto } from './dto/list-enrollments.dto';
import { EnrollmentsService } from './enrollments.service';

@UseGuards(SchoolMemberGuard)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  async findAll(@Query() query: ListEnrollmentsDto) {
    return this.enrollmentsService.findAll(
      query.academicYearId,
      query.sectionId,
    );
  }
}
