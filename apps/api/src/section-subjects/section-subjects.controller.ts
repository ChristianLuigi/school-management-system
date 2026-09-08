import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { RequestWithAuth } from '../auth/auth-request';
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
  async findAll(
    @Query() query: ListSectionSubjectsDto,
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;

    return this.sectionSubjectsService.findAll(
      query.academicYearId,
      query.sectionId,
      session?.user_id ?? '',
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
}
