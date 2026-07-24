import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { StructuredLogger } from './structured-logger';

export type RequestWithId = Request & {
  requestId?: string;
};

function requestIdFromHeader(value: string | undefined) {
  if (value && /^[A-Za-z0-9._-]{8,128}$/.test(value)) {
    return value;
  }
  return randomUUID();
}

export function requestLoggingMiddleware(logger: StructuredLogger) {
  return (request: RequestWithId, response: Response, next: NextFunction) => {
    const startedAt = performance.now();
    const requestId = requestIdFromHeader(request.header('x-request-id'));
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      logger.log({
        event: 'http_request_completed',
        requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    });

    next();
  };
}
