import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema';
import { DatabaseNotConfiguredError, DatabaseError } from '../lib/errors/AppError';
import { secretsManager } from '../lib/security/secrets';

declare global {
  // eslint-disable-next-line no-var
  var _cineshieldPgPool: Pool | undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(
    (secretsManager.getSecret('SQL_HOST') && secretsManager.getSecret('SQL_USER') && secretsManager.getSecret('SQL_PASSWORD')) ||
      secretsManager.getSecret('DATABASE_URL')
  );
}

export function getPoolConfig(): PoolConfig {
  const sqlHost = secretsManager.getSecret('SQL_HOST');
  const sqlUser = secretsManager.getSecret('SQL_USER');
  const sqlPass = secretsManager.getSecret('SQL_PASSWORD');
  const sqlDb = secretsManager.getSecret('SQL_DB_NAME') || 'cloud_sql_development_database';

  // Prefer Cloud SQL Object Configuration
  if (sqlHost && sqlUser && sqlPass) {
    return {
      host: sqlHost,
      user: sqlUser,
      password: sqlPass,
      database: sqlDb,
      max: process.env.NODE_ENV === 'production' ? 20 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    };
  }

  const dbUrl = secretsManager.getSecret('DATABASE_URL');
  if (dbUrl) {
    return {
      connectionString: dbUrl,
      max: process.env.NODE_ENV === 'production' ? 20 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    };
  }

  return {
    host: sqlHost || 'localhost',
    user: sqlUser || 'postgres',
    password: sqlPass || 'password',
    database: sqlDb,
    max: process.env.NODE_ENV === 'production' ? 20 : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  };
}

export function createOrGetPool(): Pool {
  if (!isDatabaseConfigured()) {
    throw new DatabaseNotConfiguredError(
      'Database not configured. PostgreSQL credentials or DATABASE_URL not set.'
    );
  }

  if (!global._cineshieldPgPool) {
    const config = getPoolConfig();
    global._cineshieldPgPool = new Pool(config);

    global._cineshieldPgPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL pool client:', err.message);
    });
  }

  return global._cineshieldPgPool;
}

/**
 * Gracefully terminates all active PostgreSQL pool clients for container shutdown
 */
export async function closePool(): Promise<void> {
  if (global._cineshieldPgPool) {
    await global._cineshieldPgPool.end();
    global._cineshieldPgPool = undefined;
    _db = null;
  }
}

let _db: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!isDatabaseConfigured()) {
    throw new DatabaseNotConfiguredError(
      'Database not configured. Please configure DATABASE_URL or SQL_* environment variables to persist data.'
    );
  }

  if (!_db) {
    const pool = createOrGetPool();
    _db = drizzle(pool, { schema });
  }

  return _db;
}

export { schema };
