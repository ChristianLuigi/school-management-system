import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { extractBearerToken, RequestWithAuth } from './auth-request';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  private internalAuthService: InternalAuthService | null = null;

  constructor(private readonly moduleRef: ModuleRef) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const session = await this.getInternalAuthService().validateSessionToken(token);

    request.authSession = session;

    if (session.platform_role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only super admins can access this resource.');
    }

    return true;
  }

  private getInternalAuthService(): InternalAuthService {
    if (this.internalAuthService) {
      return this.internalAuthService;
    }

    const service = this.moduleRef.get(InternalAuthService, { strict: false });

    if (!service) {
      throw new InternalServerErrorException('Internal auth service is unavailable.');
    }

    this.internalAuthService = service;
    return service;
  }
}
