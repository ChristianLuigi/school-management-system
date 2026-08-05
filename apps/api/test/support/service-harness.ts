import { ConfigService } from '@nestjs/config';
import { AccessManagementService } from '../../src/access-management/access-management.service';
import { GradebooksService } from '../../src/gradebooks/gradebooks.service';
import { CashierWorkflowService } from '../../src/finance-operations/cashier-workflow.service';
import { FinanceCorrectionsService } from '../../src/finance-operations/finance-corrections.service';
import { FinanceBillingService } from '../../src/finance-operations/finance-billing.service';
import { FinanceOperationsService } from '../../src/finance-operations/finance-operations.service';
import { FinancePayrollService } from '../../src/finance-payroll/finance-payroll.service';
import { FinanceReconciliationService } from '../../src/finance-operations/finance-reconciliation.service';
import { AttendanceService } from '../../src/attendance/attendance.service';
import { AuthService } from '../../src/auth/auth.service';
import { InvitationsService } from '../../src/auth/invitations.service';
import { AuthTokenService } from '../../src/auth/security/auth-token.service';
import { PasswordService } from '../../src/auth/security/password.service';
import { SessionTokenService } from '../../src/auth/security/session-token.service';
import { DbService } from '../../src/db/db.service';
import { PlatformActivityService } from '../../src/platform-activity/platform-activity.service';
import { SchoolStudentsService } from '../../src/school-students/school-students.service';
import { StaffComplianceService } from '../../src/staff-management/staff-compliance.service';
import { StaffManagementService } from '../../src/staff-management/staff-management.service';
import { StaffSelfServiceService } from '../../src/staff-management/staff-self-service.service';
import { CapturingEmailService } from './capturing-email.service';
import { integrationDatabaseUrl } from './integration-database';

export async function createServiceHarness() {
  const db = new DbService(
    new ConfigService({
      DATABASE_URL: integrationDatabaseUrl(),
    }),
  );
  const passwords = new PasswordService();
  await passwords.onModuleInit();
  const authTokens = new AuthTokenService();
  const sessionTokens = new SessionTokenService();
  const email = new CapturingEmailService();
  const activity = new PlatformActivityService(db);
  const auth = new AuthService(db, passwords, authTokens, sessionTokens, email);
  const invitations = new InvitationsService(
    db,
    authTokens,
    passwords,
    email,
    activity,
  );
  const access = new AccessManagementService(db, activity);
  const attendance = new AttendanceService(db, activity);
  const cashier = new CashierWorkflowService(db, activity);
  const finance = new FinanceOperationsService(db, activity, cashier);
  const payroll = new FinancePayrollService(db, activity);
  const corrections = new FinanceCorrectionsService(db, cashier, activity);
  const billing = new FinanceBillingService(db, activity);
  const reconciliation = new FinanceReconciliationService(db, activity);
  const gradebooks = new GradebooksService(db, activity);
  const schoolStudents = new SchoolStudentsService(db, activity);
  const staffManagement = new StaffManagementService(db, activity, invitations);
  const staffCompliance = new StaffComplianceService(db, activity);
  const staffSelfService = new StaffSelfServiceService(db, activity);

  return {
    access,
    activity,
    attendance,
    cashier,
    billing,
    corrections,
    finance,
    payroll,
    reconciliation,
    gradebooks,
    auth,
    authTokens,
    db,
    email,
    invitations,
    passwords,
    sessionTokens,
    schoolStudents,
    staffManagement,
    staffCompliance,
    staffSelfService,
    close: () => db.onModuleDestroy(),
  };
}
