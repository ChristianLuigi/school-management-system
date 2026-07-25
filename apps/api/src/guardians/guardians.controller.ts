import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { ListGuardiansDto } from './dto/list-guardians.dto';
import { GuardiansService } from './guardians.service';

@UseGuards(SchoolMemberGuard)
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Get()
  async findAll(@Query() query: ListGuardiansDto) {
    return this.guardiansService.findAll(query.schoolId);
  }
}
