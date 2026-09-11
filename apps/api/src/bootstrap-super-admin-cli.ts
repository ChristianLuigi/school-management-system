import { BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { PasswordService } from './auth/security/password.service';
import { SuperAdminBootstrapService } from './platform-bootstrap/super-admin-bootstrap.service';

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new BadRequestException(`${name} is required.`);
  }
  return value;
}

function safeMessage(error: unknown) {
  if (error instanceof BadRequestException) {
    return error.message;
  }
  return 'Super Admin bootstrap failed. Verify the database connection and migration status.';
}

async function main() {
  const pool = new Pool({
    connectionString: required('DATABASE_URL'),
    max: 1,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
          }
        : undefined,
  });

  try {
    const service = new SuperAdminBootstrapService(
      pool,
      new PasswordService(),
    );
    const result = await service.bootstrap({
      confirmation: required('BOOTSTRAP_SUPER_ADMIN_CONFIRMATION'),
      email: required('BOOTSTRAP_SUPER_ADMIN_EMAIL'),
      password: required('BOOTSTRAP_SUPER_ADMIN_PASSWORD'),
      firstName: required('BOOTSTRAP_SUPER_ADMIN_FIRST_NAME'),
      lastName: required('BOOTSTRAP_SUPER_ADMIN_LAST_NAME'),
    });
    process.stdout.write(
      `${JSON.stringify({
        level: 'info',
        event: 'super_admin_bootstrapped',
        ...result,
      })}\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      event: 'super_admin_bootstrap_failed',
      message: safeMessage(error),
    })}\n`,
  );
  process.exitCode = 1;
});
