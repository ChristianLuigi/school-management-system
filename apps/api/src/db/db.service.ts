import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { StructuredLogger } from '../common/observability/structured-logger';

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL is missing in environment variables.');
    }

    this.pool = new Pool({
      connectionString,
      max: Number(this.configService.get<string>('DB_POOL_MAX') ?? 20),
      connectionTimeoutMillis: Number(
        this.configService.get<string>('DB_CONNECTION_TIMEOUT_MS') ?? 5_000,
      ),
      idleTimeoutMillis: Number(
        this.configService.get<string>('DB_IDLE_TIMEOUT_MS') ?? 30_000,
      ),
      ssl:
        this.configService.get<string>('DATABASE_SSL') === 'true'
          ? {
              rejectUnauthorized:
                this.configService.get<string>(
                  'DATABASE_SSL_REJECT_UNAUTHORIZED',
                ) !== 'false',
            }
          : undefined,
    });
    this.pool.on('error', (error) => {
      new StructuredLogger().error({
        event: 'database_pool_error',
        error,
      });
    });
  }

  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    await this.pool.query('SELECT 1');
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
