import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { FindOverdueInvoicesDto } from './dto/find-overdue-invoices.dto';
import { FinanceAdminService } from './finance-admin.service';

@UseGuards(SchoolMemberGuard)
@Roles('FINANCE_ADMIN', 'SCHOOL_ADMIN')
@Controller('finance')
export class FinanceAdminController {
  constructor(private readonly financeAdminService: FinanceAdminService) {}

  @Get('overdue')
  async findOverdue(@Query() query: FindOverdueInvoicesDto) {
    return this.financeAdminService.findOverdue(query.schoolId);
  }
}
