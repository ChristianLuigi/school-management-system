import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DbModule } from '../db/db.module';
import { EmailModule } from '../email/email.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { SchoolMemberGuard } from './school-member.guard';
import { AuthTokenService } from './security/auth-token.service';
import { PasswordService } from './security/password.service';
import { SessionTokenService } from './security/session-token.service';
import { SuperAdminGuard } from './super-admin.guard';

@Global()
@Module({
  imports: [
    DbModule, InternalAuthModule, EmailModule, PlatformActivityModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
  ],
  controllers: [AuthController, InvitationsController],
  providers: [
    AuthService, SuperAdminGuard, SchoolMemberGuard, InvitationsService,
    AuthTokenService, SessionTokenService, PasswordService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [AuthService, SuperAdminGuard, SchoolMemberGuard, PasswordService],
})
export class AuthModule {}
