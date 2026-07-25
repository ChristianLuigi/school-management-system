import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApplication } from './application';
import { StructuredLogger } from './common/observability/structured-logger';

async function bootstrap() {
  const logger = new StructuredLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
  });

  configureApplication(app, logger);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');

  logger.log({
    event: 'api_started',
    port,
    environment: process.env.NODE_ENV ?? 'development',
  });
}

void bootstrap();