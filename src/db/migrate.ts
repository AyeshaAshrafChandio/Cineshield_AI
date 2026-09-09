import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { createOrGetPool, isDatabaseConfigured } from './index';
import { secretsManager } from '../lib/security/secrets';

/**
 * Executes pending SQL migrations reproducibly against PostgreSQL.
 * Uses administrative credentials (SQL_ADMIN_USER) if available since DDL operations
 * require schema owner/admin privileges.
 */
export async function runMigrations(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('Database not configured. Skipping migrations in non-database environment.');
    return;
  }

  // If admin credentials are provided, use admin pool for schema migrations
  const sqlHost = secretsManager.getSecret('SQL_HOST');
  const adminUser = secretsManager.getSecret('SQL_ADMIN_USER');
  const adminPassword = secretsManager.getSecret('SQL_ADMIN_PASSWORD');
  const sqlDb = secretsManager.getSecret('SQL_DB_NAME') || 'cloud_sql_development_database';

  let customAdminPool: Pool | null = null;
  let poolToUse: Pool;

  if (sqlHost && adminUser && adminPassword) {
    customAdminPool = new Pool({
      host: sqlHost,
      user: adminUser,
      password: adminPassword,
      database: sqlDb,
      max: 2,
      connectionTimeoutMillis: 15000,
    });
    poolToUse = customAdminPool;
  } else {
    poolToUse = createOrGetPool();
  }

  let client;
  try {
    client = await poolToUse.connect();
  } catch (connErr) {
    console.warn('Could not establish database connection for migrations:', connErr);
    if (customAdminPool) {
      await customAdminPool.end();
    }
    return;
  }

  try {
    console.log('Beginning database migration check...');
    await client.query('BEGIN');

    // Create migrations tracker table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "__cineshield_migrations" (
        "id" text PRIMARY KEY,
        "applied_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    const drizzleDir = path.join(process.cwd(), 'drizzle');
    if (!fs.existsSync(drizzleDir)) {
      console.log('No drizzle migrations directory found.');
      await client.query('COMMIT');
      return;
    }

    const migrationFiles = fs
      .readdirSync(drizzleDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const existing = await client.query(
        'SELECT id FROM "__cineshield_migrations" WHERE id = $1 LIMIT 1;',
        [file]
      );

      if (existing.rows.length === 0) {
        console.log(`Applying migration: ${file}`);
        const sqlContent = fs.readFileSync(path.join(drizzleDir, file), 'utf-8');
        await client.query(sqlContent);
        await client.query(
          'INSERT INTO "__cineshield_migrations" (id, applied_at) VALUES ($1, now());',
          [file]
        );
        console.log(`Successfully applied migration: ${file}`);
      } else {
        console.log(`Migration already applied: ${file}`);
      }
    }

    await client.query('COMMIT');
    console.log('All database migrations applied successfully.');
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const errMessage = err instanceof Error ? err.message : String(err);
    if (errMessage.includes('permission denied for schema')) {
      console.warn(
        'Note: Runtime database user lacks DDL privileges on schema public. Schema is managed via Cloud SQL UpdateSchema / Drizzle Kit migrations.'
      );
    } else {
      console.error('Database migration failed:', err);
      throw err;
    }
  } finally {
    client.release();
    if (customAdminPool) {
      await customAdminPool.end();
    }
  }
}

// Auto-run when executed directly via tsx/node
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
