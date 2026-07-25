import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { SafeExceptionFilter } from './common/http/safe-exception.filter';
import { requestLoggingMiddleware } from './common/observability/request-logging.middleware';
import { StructuredLogger } from './common/observability/structured-logger';

export function configureApplication(
  app: NestExpressApplication,
  logger: StructuredLogger,
) {
  app.set(
    'trust proxy',
    process.env.TRUST_PROXY === 'true'
      ? 1
      : process.env.TRUST_PROXY ?? false,
  );
  app.useBodyParser('json', {
    limit: process.env.JSON_BODY_LIMIT ?? '1mb',
  });
  app.useBodyParser('urlencoded', {
    extended: true,
    limit: process.env.JSON_BODY_LIMIT ?? '1mb',
  });
  app.use(requestLoggingMiddleware(logger));
  app.useGlobalFilters(new SafeExceptionFilter(logger));
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS ??
    process.env.APP_PUBLIC_URL ??
    'http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}
