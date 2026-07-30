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

  it('keeps superseded finance mutation routes retired', async () => {
    await request(app.getHttpServer()).post('/fee-plans').send({}).expect(404);
    await request(app.getHttpServer())
      .post('/payments/record')
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .post('/invoices/generate')
      .send({})
      .expect(404);
    await request(app.getHttpServer()).get('/finance/overdue').expect(404);
  });

  it('protects cashier sessions and receipt-print audit routes', async () => {
    const sessionId = randomUUID();
    const paymentId = randomUUID();

    await request(app.getHttpServer())
      .get('/finance/cashier/session')
      .query({ schoolId: randomUUID(), currencyCode: 'HTG' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/finance/cashier/sessions')
      .send({
        schoolId: randomUUID(),
        currencyCode: 'HTG',
        openingCashAmount: 0,
      })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/finance/cashier/sessions/${sessionId}/close`)
      .send({ schoolId: randomUUID(), closingCashAmount: 0 })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/finance/cashier/sessions/${sessionId}/reopen`)
      .send({
        schoolId: randomUUID(),
        reason: 'Supervisor approved correction',
      })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/finance/payments/${paymentId}/receipt-prints`)
      .send({
        schoolId: randomUUID(),
        printFormat: 'A4',
      })
      .expect(401);
  });

  it('protects payment corrections, refunds, and credit-note approvals', async () => {
    const schoolId = randomUUID();
    const paymentId = randomUUID();
    const correctionId = randomUUID();
    const invoiceId = randomUUID();
    const creditNoteId = randomUUID();

    await request(app.getHttpServer())
      .get('/finance/corrections')
      .query({ schoolId })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/finance/payments/${paymentId}/corrections`)
      .set('Idempotency-Key', 'security-correction-001')
      .send({
        schoolId,
        correctionType: 'REVERSAL',
        reason: 'Unauthorized users cannot request a reversal.',
      })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/finance/payment-corrections/${correctionId}/approve`)
      .send({ schoolId })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/finance/payment-corrections/${correctionId}/process`)
      .send({ schoolId })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/finance/invoices/${invoiceId}/credit-notes`)
      .set('Idempotency-Key', 'security-credit-note-001')
      .send({
        schoolId,
        amount: 10,
        reason: 'Unauthorized users cannot request a credit note.',
      })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/finance/credit-notes/${creditNoteId}/approve`)
      .send({ schoolId })
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
