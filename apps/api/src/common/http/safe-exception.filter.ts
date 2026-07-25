import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  RequestWithId,
} from '../observability/request-logging.middleware';
import { StructuredLogger } from '../observability/structured-logger';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error({
      event: 'http_request_failed',
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      status,
      error:
        exception instanceof Error
          ? { name: exception.name, message: exception.message }
          : { name: 'UnknownError' },
    });

    if (status >= 500) {
      response.status(status).json({
        statusCode: status,
        message: 'An internal error occurred.',
        requestId: request.requestId,
      });
      return;
    }

    const detail =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Request failed.';
    const payload =
      typeof detail === 'string'
        ? {
            statusCode: status,
            message: detail,
          }
        : detail;

    response.status(status).json({
      ...payload,
      requestId: request.requestId,
    });
  }
}
