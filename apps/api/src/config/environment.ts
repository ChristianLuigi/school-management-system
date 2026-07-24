const PRODUCTION = 'production';
const ALLOWED_NODE_ENVIRONMENTS = new Set([
  'development',
  'test',
  PRODUCTION,
]);
const INSECURE_DATABASE_PASSWORDS = new Set([
  '',
  'password',
  'postgres',
  'school_password',
]);

function looksLikePlaceholder(value: string) {
  return /(replace|placeholder|change[-_ ]?me|your[-_ ]?(?:secret|key|password))/i.test(
    value,
  );
}
function optionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireString(
  config: Record<string, unknown>,
  name: string,
  productionOnly = false,
) {
  const value = optionalString(config[name]);
  const production = config.NODE_ENV === PRODUCTION;

  if (!value && (!productionOnly || production)) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parseUrl(value: string, name: string, protocols: string[]) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (!protocols.includes(parsed.protocol)) {
    throw new Error(
      `${name} must use one of these protocols: ${protocols.join(', ')}.`,
    );
  }

  return parsed;
}

function numberSetting(
  config: Record<string, unknown>,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = optionalString(config[name]);
  const value = raw ? Number(raw) : fallback;

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const nodeEnvironment =
    optionalString(config.NODE_ENV) || 'development';

  if (!ALLOWED_NODE_ENVIRONMENTS.has(nodeEnvironment)) {
    throw new Error(
      'NODE_ENV must be development, test, or production.',
    );
  }

  const normalized: Record<string, unknown> = {
    ...config,
    NODE_ENV: nodeEnvironment,
  };
  const databaseUrl = requireString(normalized, 'DATABASE_URL');
  const database = parseUrl(databaseUrl, 'DATABASE_URL', [
    'postgres:',
    'postgresql:',
  ]);

  if (
    nodeEnvironment === PRODUCTION &&
    (INSECURE_DATABASE_PASSWORDS.has(database.password.toLowerCase()) ||
      looksLikePlaceholder(database.password))
  ) {
    throw new Error(
      'DATABASE_URL must not use a default or empty password in production.',
    );
  }

  const appPublicUrl = requireString(
    normalized,
    'APP_PUBLIC_URL',
    true,
  );
  if (appPublicUrl) {
    const publicUrl = parseUrl(appPublicUrl, 'APP_PUBLIC_URL', [
      'http:',
      'https:',
    ]);
    if (
      nodeEnvironment === PRODUCTION &&
      publicUrl.protocol !== 'https:' &&
      optionalString(normalized.ALLOW_INSECURE_HTTP) !== 'true'
    ) {
      throw new Error('APP_PUBLIC_URL must use HTTPS in production.');
    }
    normalized.APP_PUBLIC_URL = publicUrl.origin;
  }

  const configuredOrigins = optionalString(
    normalized.CORS_ALLOWED_ORIGINS,
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origins = configuredOrigins.length
    ? configuredOrigins
    : appPublicUrl
      ? [new URL(appPublicUrl).origin]
      : ['http://localhost:3001'];

  for (const origin of origins) {
    const parsed = parseUrl(origin, 'CORS_ALLOWED_ORIGINS', [
      'http:',
      'https:',
    ]);
    if (parsed.origin !== origin) {
      throw new Error(
        'CORS_ALLOWED_ORIGINS entries must be exact origins without paths.',
      );
    }
  }

  if (nodeEnvironment === PRODUCTION) {
    const resendApiKey = requireString(
      normalized,
      'RESEND_API_KEY',
      true,
    );
    const emailFrom = requireString(
      normalized,
      'AUTH_EMAIL_FROM',
      true,
    );
    if (resendApiKey.length < 10 || looksLikePlaceholder(resendApiKey)) {
      throw new Error('RESEND_API_KEY appears to be invalid.');
    }
    if (!emailFrom.includes('@')) {
      throw new Error('AUTH_EMAIL_FROM must contain a valid sender address.');
    }
  }

  const jsonBodyLimit =
    optionalString(normalized.JSON_BODY_LIMIT) || '1mb';
  if (!/^\d+(?:kb|mb)$/i.test(jsonBodyLimit)) {
    throw new Error('JSON_BODY_LIMIT must use a value such as 256kb or 1mb.');
  }

  return {
    ...normalized,
    DATABASE_URL: databaseUrl,
    CORS_ALLOWED_ORIGINS: origins.join(','),
    JSON_BODY_LIMIT: jsonBodyLimit,
    PORT: numberSetting(normalized, 'PORT', 4000, 1, 65_535),
    DB_POOL_MAX: numberSetting(normalized, 'DB_POOL_MAX', 20, 1, 100),
    DB_CONNECTION_TIMEOUT_MS: numberSetting(
      normalized,
      'DB_CONNECTION_TIMEOUT_MS',
      5_000,
      100,
      120_000,
    ),
    DB_IDLE_TIMEOUT_MS: numberSetting(
      normalized,
      'DB_IDLE_TIMEOUT_MS',
      30_000,
      1_000,
      600_000,
    ),
  };
}
