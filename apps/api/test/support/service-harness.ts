import { ConfigService } from '@nestjs/config';
import { AccessManagementService } from '../../src/access-management/access-management.service';
import { GradebooksService } from '../../src/gradebooks/gradebooks.service';
import { FinanceOperationsService } from '../../src/finance-operations/finance-operations.service';
import { AttendanceService } from '../../src/attendance/attendance.service';
import { AuthService } from '../../src/auth/auth.service';
import { InvitationsService } from '../../src/auth/invitations.service';
import { AuthTokenService } from '../../src/auth/security/auth-token.service';
import { PasswordService } from '../../src/auth/security/password.service';
import { SessionTokenService } from '../../src/auth/security/session-token.service';
import { DbService } from '../../src/db/db.service';
import { PlatformActivityService } from '../../src/platform-activity/platform-activity.service';
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
  const auth = new AuthService(
    db,
    passwords,
    authTokens,
    sessionTokens,
    email,
  );
  const invitations = new InvitationsService(
    db,
    authTokens,
    passwords,
    email,
    activity,
  );
  const access = new AccessManagementService(db, activity);
  const attendance = new AttendanceService(db, activity);
  const finance = new FinanceOperationsService(db, activity);
  const gradebooks = new GradebooksService(db, activity);

  return {
    access,
    activity,
    attendance,
    finance,
    gradebooks,
    auth,
    authTokens,
    db,
    email,
    invitations,
    passwords,
    sessionTokens,
    close: () => db.onModuleDestroy(),
  };
}
