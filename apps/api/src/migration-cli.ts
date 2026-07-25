import path from 'node:path';
import { MigrationRunner } from './database-migrations/migration-runner';

type ParsedArguments = {
  command: string;
  through?: string;
  confirmation?: string;
};

function parseArguments(values: string[]): ParsedArguments {
  const [command = 'status', ...rest] = values;
  const parsed: ParsedArguments = { command };

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--through') {
      parsed.through = rest[index + 1];
      index += 1;
    } else if (value === '--confirm') {
      parsed.confirmation = rest[index + 1];
      index += 1;
    } else {
      throw new Error(`Unsupported migration argument: ${value}`);
    }
  }

  return parsed;
}

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

  const migrationsDirectory =
    process.env.MIGRATIONS_DIR ??
    path.resolve(process.cwd(), '../../infra/db/migrations');
  const input = parseArguments(process.argv.slice(2));
  const runner = new MigrationRunner({
    databaseUrl,
    migrationsDirectory,
    applicationVersion:
      process.env.APP_VERSION ?? process.env.npm_package_version,
  });

  try {
    if (input.command === 'up') {
      const result = await runner.up();
      console.log(
        JSON.stringify(
          {
            event: 'database_migrations_applied',
            ...result,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (input.command === 'status') {
      const result = await runner.status();
      console.table(
        result.map((migration) => ({
          migration: migration.name,
          state: migration.state,
          baseline: migration.baseline,
          appliedAt: migration.appliedAt?.toISOString() ?? '',
        })),
      );
      return;
    }

    if (input.command === 'verify') {
      const result = await runner.verify();
      console.log(
        JSON.stringify(
          {
            event: 'database_migrations_verified',
            ...result,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (input.command === 'baseline') {
      if (!input.through) {
        throw new Error('Baseline requires --through <migration filename>.');
      }
      const result = await runner.baseline({
        through: input.through,
        confirmation: input.confirmation ?? '',
      });
      console.log(
        JSON.stringify(
          {
            event: 'database_migrations_baselined',
            ...result,
          },
          null,
          2,
        ),
      );
      return;
    }

    throw new Error(`Unsupported migration command: ${input.command}`);
  } finally {
    await runner.close();
  }
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'database_migration_error',
      message: safeErrorMessage(error),
    }),
  );
  process.exitCode = 1;
});
