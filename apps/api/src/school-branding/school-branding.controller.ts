import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { UpdateSchoolBrandingDto } from './dto/update-school-branding.dto';
import { SchoolBrandingService } from './school-branding.service';

@Controller('school-branding')
export class SchoolBrandingController {
  constructor(
    private readonly schoolBrandingService: SchoolBrandingService,
    private readonly internalAuthService: InternalAuthService,
  ) {}

  private async requireSession(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    return this.internalAuthService.validateSessionToken(token);
  }

  @Get()
  async getBranding(
    @Headers('authorization') authorization: string | undefined,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);

    return this.schoolBrandingService.getBranding(
      schoolId,
      session.user_id,
      session.platform_role,
    );
  }

  @Patch()
  async updateBranding(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: UpdateSchoolBrandingDto,
  ) {
    const session = await this.requireSession(authorization);

    return this.schoolBrandingService.updateBranding(
      body,
      session.user_id,
      session.platform_role,
    );
  }
}
