const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for integration tests.',
  );
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('Integration tests cannot run with NODE_ENV=production.');
}

const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.replace(/^\//, '').toLowerCase();

if (
  !databaseName ||
  (!databaseName.includes('test') && !databaseName.includes('rr_'))
) {
  throw new Error(
    'Integration database name must contain "test" or "rr_".',
  );
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = databaseUrl;
process.env.APP_PUBLIC_URL =
  process.env.APP_PUBLIC_URL ?? 'http://localhost:3001';
process.env.AUTH_PASSWORD_MIN_LENGTH =
  process.env.AUTH_PASSWORD_MIN_LENGTH ?? '15';
process.env.LOG_SILENT = 'true';
