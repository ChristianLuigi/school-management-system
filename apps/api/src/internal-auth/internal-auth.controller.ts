import { Body, Controller, Post } from '@nestjs/common';
import { LoginInternalUserDto } from './dto/login-internal-user.dto';
import { InternalAuthService } from './internal-auth.service';

@Controller('internal-auth')
export class InternalAuthController {
  constructor(
    private readonly internalAuthService: InternalAuthService,
  ) {}

  @Post('login')
  async login(@Body() body: LoginInternalUserDto) {
    return this.internalAuthService.login(body.email, body.password);
  }
}