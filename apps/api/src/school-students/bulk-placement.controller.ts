import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { BulkPlacementDto } from './dto/bulk-placement.dto';
import { BulkPlacementService } from './bulk-placement.service';
@Controller('school-students/bulk-placement')
export class BulkPlacementController {
  constructor(
    private readonly auth: InternalAuthService,
    private readonly placement: BulkPlacementService,
  ) {}
  private async session(authorization?: string) {
    if (!authorization?.startsWith('Bearer '))
      throw new UnauthorizedException();
    return this.auth.validateSessionToken(authorization.slice(7).trim());
  }
  @Post('preview')
  async preview(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: BulkPlacementDto,
  ) {
    const session = await this.session(authorization);
    return this.placement.preview(
      dto,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
  @Post()
  async commit(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: BulkPlacementDto,
  ) {
    const session = await this.session(authorization);
    return this.placement.commit(
      dto,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }
}
