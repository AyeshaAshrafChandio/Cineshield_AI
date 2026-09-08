import fs from 'fs';
import path from 'path';
import { createOrGetPool, isDatabaseConfigured } from './index';

/**
 * Executes pending SQL migrations reproducibly against PostgreSQL.
 * Can be run during Docker container startup or CI/CD pipelines.
 */
export async function runMigrations(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('Database not configured. Skipping migrations in non-database environment.');
    return;
  }

  const pool = createOrGetPool();
  const client = await pool.connect();

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
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Auto-run when executed directly via tsx/node
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
