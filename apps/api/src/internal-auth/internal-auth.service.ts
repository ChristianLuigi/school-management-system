import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class InternalAuthService {
  private secureAuth: AuthService | null = null;

  constructor(private readonly moduleRef: ModuleRef) {}

  private service() {
    if (this.secureAuth) return this.secureAuth;
    const service = this.moduleRef.get(AuthService, { strict: false });
    if (!service) throw new InternalServerErrorException('Authentication service is unavailable.');
    this.secureAuth = service;
    return service;
  }

  login(email: string, password: string) {
    return this.service().login({ email, password });
  }

  validateSessionToken(rawToken: string) {
    return this.service().requireSession(`Bearer ${rawToken}`);
  }
}
