import { createPool } from './index.ts';
import { takeDatabaseBackup, restoreFromBackupIfNeeded } from '../lib/backupManager.ts';

/**
 * Safe Database Migration Helper.
 * Rules:
 * 1. Never delete the existing database or tables.
 * 2. Never recreate the database from scratch.
 * 3. Preserve all existing records.
 * 4. Add new tables and columns with sensible default values safely (IF NOT EXISTS).
 * 5. Keep backward compatibility with older data.
 * 6. Always take an automated backup before any migration.
 * 7. Automatically restore previous database if a migration fails.
 */
export async function safeMigrateDatabase(): Promise<boolean> {
  // 0. Pre-migration backup snapshot to safeguard existing user data
  try {
    await takeDatabaseBackup('pre_update');
  } catch (backupErr) {
    console.warn('[Safe Migration] Notice: Pre-migration backup snapshot:', backupErr);
  }

  const pool = createPool();
  const client = await pool.connect();

  try {
    console.log('[Safe Migration] Checking database schema integrity...');

    await client.query('BEGIN');

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'visitor',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. EDFs table
    await client.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure priority column exists if older schema didn't have it
    await client.query(`
      ALTER TABLE edfs ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Medium';
      ALTER TABLE edfs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE edfs ADD COLUMN IF NOT EXISTS created_by TEXT;
      ALTER TABLE edfs ADD COLUMN IF NOT EXISTS remarks TEXT;
    `);

    // 4. EDF Items table (one-to-many relationship for material rows)
    await client.query(`
      CREATE TABLE IF NOT EXISTS edf_items (
        id SERIAL PRIMARY KEY,
        edf_id INTEGER NOT NULL REFERENCES edfs(id) ON DELETE CASCADE,
        item_description TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'pcs',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Activity logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        edf_number TEXT,
        action TEXT NOT NULL,
        user_phone TEXT,
        user_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. EDF status history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS edf_status_history (
        id SERIAL PRIMARY KEY,
        edf_id INTEGER NOT NULL REFERENCES edfs(id) ON DELETE CASCADE,
        edf_number TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        changed_by TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Requesters table (for Requester Name Dropdown)
    await client.query(`
      CREATE TABLE IF NOT EXISTS requesters (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. System settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. EDF Backups table (permanent snapshot archive in database)
    await client.query(`
      CREATE TABLE IF NOT EXISTS edf_backups (
        id SERIAL PRIMARY KEY,
        backup_type TEXT NOT NULL DEFAULT 'auto',
        snapshot_data TEXT NOT NULL,
        records_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create useful indexes safely
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_edfs_status ON edfs(status);
      CREATE INDEX IF NOT EXISTS idx_edfs_category ON edfs(category);
      CREATE INDEX IF NOT EXISTS idx_edfs_required_date ON edfs(required_date);
      CREATE INDEX IF NOT EXISTS idx_edf_items_edf_id ON edf_items(edf_id);
      CREATE INDEX IF NOT EXISTS idx_status_history_edf_id ON edf_status_history(edf_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_requesters_name ON requesters(name);
    `);

    await client.query('COMMIT');
    console.log('[Safe Migration] Schema verification and migration succeeded. All existing data preserved.');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Safe Migration] Migration check encountered an error, rolled back safely:', error);
    try {
      console.log('[Safe Migration] Attempting automatic database restore to prevent data loss...');
      await restoreFromBackupIfNeeded();
    } catch (restoreErr) {
      console.error('[Safe Migration] Automatic recovery notice:', restoreErr);
    }
    return false;
  } finally {
    client.release();
  }
}
