import {
  Controller,
  Get,
  Headers,
  Query,
} from '@nestjs/common';
import { AccessManagementService } from '../access-management/access-management.service';
import { AuthService } from '../auth/auth.service';
import { ParentFinanceSummaryDto } from './dto/parent-finance-summary.dto';
import { InvoicesService } from './invoices.service';

@Controller('parent/finance')
export class ParentFinanceController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly authService: AuthService,
    private readonly accessManagementService: AccessManagementService,
  ) {}

  @Get('summary')
  async summary(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ParentFinanceSummaryDto,
  ) {
    const session = await this.authService.requireSession(authorization);
    const schoolId =
      await this.accessManagementService.assertParentGuardianStudent(
      session.user_id,
      query.guardianId,
      query.studentId,
    );
    return this.invoicesService.findParentSummary(
      schoolId,
      query.guardianId,
      query.studentId,
    );
  }
}
