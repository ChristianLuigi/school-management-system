import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateUserInvitationDto } from './dto/create-user-invitation.dto';
import { InspectInvitationDto } from './dto/inspect-invitation.dto';
import { ResendInvitationDto } from './dto/resend-invitation.dto';
import { UpdateSchoolMembershipStatusDto } from './dto/update-school-membership-status.dto';
import { InvitationsService } from './invitations.service';
import { extractBearerToken } from './auth-request';

@Controller('auth/invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly auth: InternalAuthService,
  ) {}

  private async session(authorization?: string) {
    const token = extractBearerToken(authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token.');
    return this.auth.validateSessionToken(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('inspect')
  inspect(@Body() body: InspectInvitationDto) {
    return this.invitations.inspectInvitation(body.token);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('accept')
  accept(@Body() body: AcceptInvitationDto) {
    return this.invitations.acceptInvitation(body);
  }

  @Get()
  async list(@Headers('authorization') authorization: string | undefined, @Query('schoolId') schoolId: string) {
    const session = await this.session(authorization);
    return this.invitations.listSchoolUsers(
      schoolId, session.user_id, session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post()
  async create(@Headers('authorization') authorization: string | undefined, @Body() body: CreateUserInvitationDto) {
    const session = await this.session(authorization);
    return this.invitations.createInvitation(
      body, session.user_id, session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('accept-existing')
  async acceptExisting(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: InspectInvitationDto,
  ) {
    const session = await this.session(authorization);
    return this.invitations.acceptInvitationForExistingUser(body.token, session.user_id);
  }

  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('resend')
  async resend(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ResendInvitationDto,
  ) {
    const session = await this.session(authorization);
    return this.invitations.resendInvitation(
      body.invitationId, session.user_id, session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Delete(':invitationId')
  async revoke(
    @Headers('authorization') authorization: string | undefined,
    @Param('invitationId') invitationId: string,
  ) {
    const session = await this.session(authorization);
    return this.invitations.revokeInvitation(
      invitationId, session.user_id, session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Patch('school-users/:membershipId/status')
  async updateMembershipStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateSchoolMembershipStatusDto,
  ) {
    const session = await this.session(authorization);
    return this.invitations.updateSchoolMembershipStatus(
      membershipId,
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
}
