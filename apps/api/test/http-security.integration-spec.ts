import {
  Controller,
  Get,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/application';
import { StructuredLogger } from '../src/common/observability/structured-logger';
import {
  createIntegrationPool,
  resetIntegrationDatabase,
} from './support/integration-database';

@Controller('__release-test')
class ReleaseFailureController {
  @Get('failure')
  fail() {
    throw new Error(
      'password=never-return-this postgresql://user:secret@db/private',
    );
  }
}

describe('HTTP runtime security integration', () => {
  const pool = createIntegrationPool();
  let app: INestApplication<App>;

  beforeAll(async () => {
    await resetIntegrationDatabase(pool);
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ReleaseFailureController],
    }).compile();
    const nestApp = module.createNestApplication<NestExpressApplication>();
    configureApplication(nestApp, new StructuredLogger());
    await nestApp.init();
    app = nestApp;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('provides liveness, readiness, request IDs, and security headers', async () => {
    const live = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(live.body).toMatchObject({ status: 'ok' });
    expect(live.headers['x-request-id']).toMatch(
      /^[A-Za-z0-9._-]{8,128}$/,
    );
    expect(live.headers['x-content-type-options']).toBe('nosniff');
    expect(live.headers['x-frame-options']).toBe('SAMEORIGIN');

    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'ok', database: 'up' });
      });
  });

  it('protects legacy school listings and parent finance routes', async () => {
    await request(app.getHttpServer()).get('/schools').expect(401);
    await request(app.getHttpServer())
      .get('/parent/finance/summary')
      .query({
        guardianId: randomUUID(),
        studentId: randomUUID(),
      })
      .expect(401);
  });

  it('returns safe production-style errors with a correlation ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/__release-test/failure')
      .expect(500);

    expect(response.body).toMatchObject({
      statusCode: 500,
      message: 'An internal error occurred.',
    });
    expect(response.text).toContain(String(response.headers['x-request-id']));
    expect(JSON.stringify(response.body)).not.toMatch(
      /never-return-this|postgresql|secret/i,
    );
  });

  it('allows only configured CORS origins', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3001',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const rejected = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'https://malicious.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate-limits repeated login attempts', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'rate-limit@release.test',
          password: 'Incorrect Password 42!Stone',
        })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'rate-limit@release.test',
        password: 'Incorrect Password 42!Stone',
      })
      .expect(429);
  });
});
