import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
import { FindFeePlansDto } from './dto/find-fee-plans.dto';
import { FeePlansService } from './fee-plans.service';

@UseGuards(SchoolMemberGuard)
@Roles('FINANCE_ADMIN', 'SCHOOL_ADMIN')
@Controller('fee-plans')
export class FeePlansController {
  constructor(private readonly feePlansService: FeePlansService) {}

  @Get()
  async findAll(@Query() query: FindFeePlansDto) {
    return this.feePlansService.findAll(query.schoolId);
  }

  @Post()
  async create(@Body() body: CreateFeePlanDto) {
    return this.feePlansService.create(body);
  }
}
