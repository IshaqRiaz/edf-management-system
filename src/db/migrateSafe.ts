import { Pool } from 'pg';
import { createPool } from './index.ts';

/**
 * Safe Database Migration Runner
 * Guarantees that:
 * 1. Existing tables are NEVER dropped or erased.
 * 2. New tables are created safely if not present.
 * 3. Any newly added columns are added with IF NOT EXISTS and sensible default values.
 * 4. Backward compatibility with all older data is strictly preserved.
 */
export async function runSafeDatabaseMigration(): Promise<void> {
  const pool: Pool = createPool();

  try {
    console.log('[Database Migration] Running safe schema verification...');

    // 1. Create tables if not exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'visitor',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS requesters (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS edf_backups (
        id SERIAL PRIMARY KEY,
        backup_type TEXT NOT NULL DEFAULT 'auto',
        snapshot_data TEXT NOT NULL,
        records_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS edfs (
        id SERIAL PRIMARY KEY,
        edf_number TEXT NOT NULL UNIQUE,
        requester_name TEXT NOT NULL,
        category TEXT NOT NULL,
        issue_date TIMESTAMP NOT NULL,
        required_date TIMESTAMP NOT NULL,
        material_list TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'pcs',
        status TEXT NOT NULL DEFAULT 'Pending',
        priority TEXT NOT NULL DEFAULT 'Medium',
        remarks TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS edf_items (
        id SERIAL PRIMARY KEY,
        edf_id INTEGER NOT NULL REFERENCES edfs(id) ON DELETE CASCADE,
        item_description TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'pcs',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        edf_number TEXT,
        action TEXT NOT NULL,
        user_phone TEXT,
        user_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS edf_status_history (
        id SERIAL PRIMARY KEY,
        edf_id INTEGER NOT NULL REFERENCES edfs(id) ON DELETE CASCADE,
        edf_number TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        changed_by TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Safe additive column migrations (ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
    // Ensures any columns added in future updates won't fail and won't drop existing records.
    await pool.query(`
      ALTER TABLE edfs ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Medium';
      ALTER TABLE edfs ADD COLUMN IF NOT EXISTS remarks TEXT;
      ALTER TABLE edfs ADD COLUMN IF NOT EXISTS created_by TEXT;
      ALTER TABLE edfs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
      ALTER TABLE edfs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

      ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'visitor';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

      ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

      ALTER TABLE edf_status_history ADD COLUMN IF NOT EXISTS changed_by TEXT;
      ALTER TABLE edf_status_history ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE edf_status_history ADD COLUMN IF NOT EXISTS from_status TEXT;
    `);

    console.log('[Database Migration] Schema verification completed safely.');
  } catch (err) {
    console.error('[Database Migration] Error during safe migration:', err);
    // Do not throw, allow application to continue
  }
}
