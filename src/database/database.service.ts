import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import pgvector from 'pgvector/pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');
const ADVISORY_LOCK_KEY = 982347123;

/**
 * Owns the pg connection pool, registers the pgvector type codec on every
 * connection, and applies SQL migrations on boot (advisory-locked so the API
 * and any other instance don't race).
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: Pool;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.pool = new Pool({ connectionString: this.config.get<string>('databaseUrl') });
    // pgvector needs its type OID registered per physical connection.
    this.pool.on('connect', (client) => {
      pgvector.registerType(client).catch((err) =>
        this.logger.error(`failed to register pgvector type: ${err}`),
      );
    });
  }

  async onModuleInit(): Promise<void> {
    await this.migrate();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.pool.query(text, params as never) as never;
  }

  async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  private render(sql: string): string {
    const dim = String(this.config.get<number>('gemini.embeddingDim') ?? 768);
    return sql.replace(/\$\{EMBEDDING_DIM\}/g, dim);
  }

  private async migrate(): Promise<void> {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort();

    await this.withClient(async (client) => {
      await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
      try {
        await client.query(
          `CREATE TABLE IF NOT EXISTS schema_migrations (
             name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
           )`,
        );
        const applied = new Set(
          (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
            (r) => r.name,
          ),
        );
        for (const file of files) {
          if (applied.has(file)) continue;
          this.logger.log(`applying migration ${file}`);
          const sql = this.render(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
          await client.query('BEGIN');
          try {
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          }
        }
        this.logger.log(`migrations up to date (${files.length} total)`);
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
      }
    });
  }
}
