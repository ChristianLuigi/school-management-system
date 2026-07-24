import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { ListTeachersDto } from './dto/list-teachers.dto';
import { TeachersService } from './teachers.service';

@UseGuards(SchoolMemberGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  async findAll(@Query() query: ListTeachersDto) {
    return this.teachersService.findAll(query.schoolId);
  }
}
