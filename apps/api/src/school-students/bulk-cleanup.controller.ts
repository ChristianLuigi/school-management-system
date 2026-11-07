import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { BulkCleanupService } from './bulk-cleanup.service';
import { BulkCleanupDto, CleanupCandidatesDto } from './dto/bulk-cleanup.dto';

@Controller('school-students/cleanup')
export class BulkCleanupController {
  constructor(
    private readonly auth: InternalAuthService,
    private readonly cleanup: BulkCleanupService,
  ) {}
  private async session(authorization?: string) {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException();
    return this.auth.validateSessionToken(authorization.slice(7).trim());
  }
  @Get()
  async candidates(
    @Headers('authorization') authorization: string | undefined,
    @Query() dto: CleanupCandidatesDto,
  ) {
    const session = await this.session(authorization);
    return this.cleanup.candidates(
      dto,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
  @Post('preview')
  async preview(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: BulkCleanupDto,
  ) {
    const session = await this.session(authorization);
    return this.cleanup.preview(
      dto,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
  @Post()
  async commit(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: BulkCleanupDto,
  ) {
    const session = await this.session(authorization);
    return this.cleanup.commit(
      dto,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
}
