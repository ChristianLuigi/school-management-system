import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { CreateStudentDiscountDto } from './dto/create-student-discount.dto';
import { FindStudentDiscountsDto } from './dto/find-student-discounts.dto';
import { StudentDiscountsService } from './student-discounts.service';

@UseGuards(SchoolMemberGuard)
@Roles('FINANCE_ADMIN', 'SCHOOL_ADMIN')
@Controller('student-discounts')
export class StudentDiscountsController {
  constructor(
    private readonly studentDiscountsService: StudentDiscountsService,
  ) {}

  @Get()
  async findAll(@Query() query: FindStudentDiscountsDto) {
    return this.studentDiscountsService.findAll(query.studentId);
  }

  @Post()
  async create(@Body() body: CreateStudentDiscountDto) {
    return this.studentDiscountsService.create(body);
  }
}
