import { Pool } from 'pg';
import { collectStaffReconciliation } from './staff-directory/staff-reconciliation';

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@')
    .replace(/password\s*=\s*[^\s]+/gi, 'password=[REDACTED]');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const argumentsList = process.argv.slice(2);
  const unsupported = argumentsList.filter((value) => value !== '--strict');
  if (unsupported.length) {
    throw new Error(
      `Unsupported staff reconciliation argument: ${unsupported[0]}`,
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
          }
        : undefined,
  });

  try {
    const report = await collectStaffReconciliation(pool);
    console.log(JSON.stringify(report, null, 2));

    if (argumentsList.includes('--strict') && !report.ready) {
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'staff_directory_reconciliation_error',
      message: safeErrorMessage(error),
    }),
  );
  process.exitCode = 1;
});
