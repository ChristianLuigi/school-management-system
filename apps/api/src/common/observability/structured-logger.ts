import { LoggerService } from '@nestjs/common';

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'passwordconfirmation',
  'password_hash',
  'resend_api_key',
  'sessiontoken',
  'token',
  'token_hash',
]);

function redactString(value: string) {
  return value
    .replace(/password\s*=\s*[^\s,;]+/gi, 'password=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(
      /postgres(?:ql)?:\/\/[^@\s]+@/gi,
      'postgresql://[REDACTED]@',
    )
    .replace(
      /([?&#](?:token|sessionToken|password)=)[^&#\s]+/gi,
      '$1[REDACTED]',
    );
}

function safeValue(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Error) {
    return {
      errorName: value.name,
      message: redactString(value.message),
    };
  }
  if (Array.isArray(value)) return value.map((entry) => safeValue(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase())
          ? '[REDACTED]'
          : safeValue(entry),
      ]),
    );
  }
  return value;
}

export class StructuredLogger implements LoggerService {
  private readonly production = process.env.NODE_ENV === 'production';
  private readonly silent = process.env.LOG_SILENT === 'true';
  private readonly service = process.env.SERVICE_NAME ?? 'almac-api';
  private readonly version = process.env.APP_VERSION ?? 'development';

  log(message: unknown, ...optionalParams: unknown[]) {
    this.write('info', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.write('fatal', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write('trace', message, optionalParams);
  }

  private write(
    level: string,
    message: unknown,
    optionalParams: unknown[],
  ) {
    if (this.silent) return;

    const record = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      version: this.version,
      message: safeValue(message),
      ...(optionalParams.length
        ? { context: safeValue(optionalParams) }
        : {}),
    };

    if (this.production) {
      const output = JSON.stringify(record);
      if (level === 'error' || level === 'fatal') {
        console.error(output);
      } else {
        console.log(output);
      }
      return;
    }

    const context = optionalParams.length
      ? ` ${JSON.stringify(safeValue(optionalParams))}`
      : '';
    const rendered =
      typeof record.message === 'string'
        ? record.message
        : JSON.stringify(record.message);
    const output = `[${record.timestamp}] ${level.toUpperCase()} ${rendered}${context}`;

    if (level === 'error' || level === 'fatal') {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}
