declare module 'pg' {
  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
    rows: T[];
    rowCount: number | null;
  }

  export interface QueryConfig {
    text: string;
    values?: unknown[];
  }

  export interface PoolClient {
    query<T extends QueryResultRow = QueryResultRow>(
      queryTextOrConfig: string | QueryConfig,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
    release(err?: Error | boolean): void;
  }

  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    connectionTimeoutMillis?: number;
    idleTimeoutMillis?: number;
    ssl?: boolean | { rejectUnauthorized?: boolean };
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T extends QueryResultRow = QueryResultRow>(
      queryTextOrConfig: string | QueryConfig,
      values?: unknown[],
    ): Promise<QueryResult<T>>;
    on(
      event: 'error',
      listener: (error: Error, client?: PoolClient) => void,
    ): this;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
