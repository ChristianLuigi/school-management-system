import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AcceptSchoolInvitationDto } from './dto/accept-school-invitation.dto';
import { ResolveSchoolInvitationDto } from './dto/resolve-school-invitation.dto';
import { SchoolInvitationsService } from './school-invitations.service';

@Controller('school-invitations')
export class SchoolInvitationsController {
  constructor(
    private readonly schoolInvitationsService: SchoolInvitationsService,
  ) {}

  @Get('resolve')
  async resolve(@Query() query: ResolveSchoolInvitationDto) {
    return this.schoolInvitationsService.resolve(query.token);
  }

  @Post('accept')
  async accept(@Body() body: AcceptSchoolInvitationDto) {
    return this.schoolInvitationsService.accept(
      body.token,
      body.password,
    );
  }
}
