import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { ListSubjectsDto } from './dto/list-subjects.dto';
import { SubjectsService } from './subjects.service';

@UseGuards(SchoolMemberGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  async findAll(@Query() query: ListSubjectsDto) {
    return this.subjectsService.findAll(query.schoolId);
  }
}
