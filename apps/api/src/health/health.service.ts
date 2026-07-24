import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class HealthService {
  constructor(private readonly dbService: DbService) {}

  liveness() {
    return {
      status: 'ok' as const,
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.APP_VERSION ?? 'development',
      timestamp: new Date().toISOString(),
    };
  }

  async readiness() {
    try {
      await this.dbService.ping();

      return {
        status: 'ok' as const,
        database: 'up' as const,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'error' as const,
        database: 'down' as const,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
