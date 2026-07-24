import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { FindPaymentsDto } from './dto/find-payments.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PaymentsService } from './payments.service';

@UseGuards(SchoolMemberGuard)
@Roles('FINANCE_ADMIN', 'SCHOOL_ADMIN')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  async findAll(@Query() query: FindPaymentsDto) {
    return this.paymentsService.findAll(query.invoiceId);
  }

  @Post('record')
  async record(@Body() body: RecordPaymentDto) {
    return this.paymentsService.record(body);
  }
}
