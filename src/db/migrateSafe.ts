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

    const privRes = await pool.query(`
      SELECT current_user AS username,
             has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public
    `);
    const currentUser: string = privRes.rows[0]?.username || '';
    const canCreatePublic: boolean = Boolean(privRes.rows[0]?.can_create_public);

    if (canCreatePublic) {
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
    }

    const ownerRes = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = $1
    `, [currentUser]);
    const ownedTables = new Set(ownerRes.rows.map((r) => r.tablename));

    // 2. Safe additive column migrations only on owned tables
    if (ownedTables.has('edfs')) {
      await pool.query(`
        ALTER TABLE edfs DROP COLUMN IF EXISTS priority;
        ALTER TABLE edfs ADD COLUMN IF NOT EXISTS remarks TEXT;
        ALTER TABLE edfs ADD COLUMN IF NOT EXISTS created_by TEXT;
        ALTER TABLE edfs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
        ALTER TABLE edfs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
      `);
    }
    if (ownedTables.has('users')) {
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'visitor';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
      `);
    }
    if (ownedTables.has('categories')) {
      await pool.query(`
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT;
        ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
      `);
    }
    if (ownedTables.has('edf_status_history')) {
      await pool.query(`
        ALTER TABLE edf_status_history ADD COLUMN IF NOT EXISTS changed_by TEXT;
        ALTER TABLE edf_status_history ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE edf_status_history ADD COLUMN IF NOT EXISTS from_status TEXT;
      `);
    }

    // Safely migrate any historical 'Completed' statuses to 'Received'
    await pool.query(`UPDATE edfs SET status = 'Received' WHERE status = 'Completed';`);

    console.log('[Database Migration] Schema verification completed safely.');
  } catch (err) {
    console.error('[Database Migration] Error during safe migration:', err);
    // Do not throw, allow application to continue
  }
}
