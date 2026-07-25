import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness() {
    return this.healthService.liveness();
  }

  @Get('ready')
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.healthService.readiness();
    if (readiness.status !== 'ok') response.status(503);
    return readiness;
  }

  @Get()
  async getHealth(@Res({ passthrough: true }) response: Response) {
    return this.getReadiness(response);
  }
}