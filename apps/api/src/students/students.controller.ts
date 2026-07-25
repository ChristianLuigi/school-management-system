import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { ListStudentsDto } from './dto/list-students.dto';
import { StudentsService } from './students.service';

@UseGuards(SchoolMemberGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  async findAll(@Query() query: ListStudentsDto) {
    return this.studentsService.findAll(query.schoolId);
  }
}
