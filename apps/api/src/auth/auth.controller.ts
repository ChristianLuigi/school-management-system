import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { InspectPasswordResetDto } from './dto/inspect-password-reset.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() body: LoginDto) { return this.auth.login(body); }

  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @Post('password-reset/request')
  requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(body);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password-reset/inspect')
  inspectPasswordReset(@Body() body: InspectPasswordResetDto) {
    return this.auth.inspectPasswordReset(body.token);
  }

  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() body: ConfirmPasswordResetDto) {
    return this.auth.confirmPasswordReset(body);
  }
  @Post('logout')
  logout(@Headers('authorization') authorization?: string) { return this.auth.logout(authorization); }

  @Post('logout-all')
  logoutAll(@Headers('authorization') authorization?: string) { return this.auth.logoutAll(authorization); }

  @Get('me')
  me(@Headers('authorization') authorization?: string) { return this.auth.requireSession(authorization); }
}
