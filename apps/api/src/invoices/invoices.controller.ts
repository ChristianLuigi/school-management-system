import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { SkipSchoolMembership } from '../auth/skip-school-membership.decorator';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { FindInvoicesDto } from './dto/find-invoices.dto';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { RecalculateInvoiceDto } from './dto/recalculate-invoice.dto';
import { InvoicesService } from './invoices.service';

@UseGuards(SchoolMemberGuard)
@Roles('FINANCE_ADMIN', 'SCHOOL_ADMIN')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(@Query() query: FindInvoicesDto) {
    return this.invoicesService.findAll(query.schoolId, query.studentId);
  }

  @Post('generate')
  async generate(@Body() body: GenerateInvoiceDto) {
    return this.invoicesService.generate(body);
  }

  @Post('recalculate')
  async recalculate(@Body() body: RecalculateInvoiceDto) {
    return this.invoicesService.recalculate(body.invoiceId);
  }

  @Post('mark-overdue')
  @SkipSchoolMembership()
  @UseGuards(SuperAdminGuard)
  async markOverdue() {
    return this.invoicesService.markOverdue();
  }
}
