import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { ListSectionSubjectsDto } from './dto/list-section-subjects.dto';
import { SectionSubjectsService } from './section-subjects.service';

@UseGuards(SchoolMemberGuard)
@Roles('TEACHER', 'SCHOOL_ADMIN')
@Controller('section-subjects')
export class SectionSubjectsController {
  constructor(
    private readonly sectionSubjectsService: SectionSubjectsService,
  ) {}

  @Get()
  async findAll(@Query() query: ListSectionSubjectsDto) {
    return this.sectionSubjectsService.findAll(
      query.academicYearId,
      query.sectionId,
    );
  }
}
