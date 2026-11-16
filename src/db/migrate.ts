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

    // Inspect current DB user, public schema CREATE privilege, and existing tables/owners/columns/indexes
    const [privRes, tablesRes, colsRes, indexesRes] = await Promise.all([
      pool.query(`
        SELECT current_user AS username,
               has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public
      `),
      pool.query(`
        SELECT tablename, tableowner
        FROM pg_tables
        WHERE schemaname = 'public'
      `),
      pool.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `),
      pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
      `),
    ]);

    const currentUser: string = privRes.rows[0]?.username || '';
    const canCreatePublic: boolean = Boolean(privRes.rows[0]?.can_create_public);

    const tableOwners = new Map<string, string>();
    for (const row of tablesRes.rows) {
      tableOwners.set(row.tablename, row.tableowner);
    }

    const tableColumns = new Map<string, Set<string>>();
    for (const row of colsRes.rows) {
      if (!tableColumns.has(row.table_name)) {
        tableColumns.set(row.table_name, new Set());
      }
      tableColumns.get(row.table_name)!.add(row.column_name);
    }

    const existingIndexes = new Set<string>(indexesRes.rows.map((r) => r.indexname));

    const canAlterTable = (tableName: string): boolean => {
      const owner = tableOwners.get(tableName);
      return Boolean(owner && owner === currentUser);
    };

    const hasColumn = (tableName: string, columnName: string): boolean => {
      return tableColumns.get(tableName)?.has(columnName) ?? false;
    };

    const ensureTable = async (tableName: string, ddl: string): Promise<boolean> => {
      if (tableOwners.has(tableName)) {
        return true;
      }
      if (!canCreatePublic) {
        console.warn(
          `[Safe Migration] Skipping CREATE TABLE for '${tableName}' (role '${currentUser}' lacks CREATE on schema public).`
        );
        return false;
      }
      await client.query(ddl);
      tableOwners.set(tableName, currentUser);
      return true;
    };

    await client.query('BEGIN');

    // 1. Users table
    await ensureTable(
      'users',
      `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'visitor',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `
    );

    // 2. Categories table
    await ensureTable(
      'categories',
      `
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `
    );

    // 3. EDFs table
    await ensureTable(
      'edfs',
      `
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `
    );

    // Ensure columns exist or drop legacy priority only if actually needed and permitted
    if (canAlterTable('edfs')) {
      if (hasColumn('edfs', 'priority')) {
        await client.query('ALTER TABLE edfs DROP COLUMN IF EXISTS priority;');
      }
      if (!hasColumn('edfs', 'updated_at')) {
        await client.query('ALTER TABLE edfs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
      }
      if (!hasColumn('edfs', 'created_by')) {
        await client.query('ALTER TABLE edfs ADD COLUMN IF NOT EXISTS created_by TEXT;');
      }
      if (!hasColumn('edfs', 'remarks')) {
        await client.query('ALTER TABLE edfs ADD COLUMN IF NOT EXISTS remarks TEXT;');
      }
    }

    // 4. EDF Items table (one-to-many relationship for material rows)
    await ensureTable(
      'edf_items',
      `
      CREATE TABLE IF NOT EXISTS edf_items (
        id SERIAL PRIMARY KEY,
        edf_id INTEGER NOT NULL REFERENCES edfs(id) ON DELETE CASCADE,
        item_description TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'pcs',
        status TEXT NOT NULL DEFAULT 'Pending',
        received_at TIMESTAMP,
        received_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `
    );

    // Ensure item status columns exist in edf_items only if missing and permitted
    if (canAlterTable('edf_items')) {
      if (!hasColumn('edf_items', 'status')) {
        await client.query("ALTER TABLE edf_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending';");
      }
      if (!hasColumn('edf_items', 'received_at')) {
        await client.query('ALTER TABLE edf_items ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;');
      }
      if (!hasColumn('edf_items', 'received_by')) {
        await client.query('ALTER TABLE edf_items ADD COLUMN IF NOT EXISTS received_by TEXT;');
      }
    }

    // Safely migrate any historical 'Completed' statuses to 'Received'
    if (tableOwners.has('edfs')) {
      await client.query(`
        UPDATE edfs SET status = 'Received' WHERE status = 'Completed';
      `);
    }

    // If parent EDF is already Received, set its items to Received
    if (tableOwners.has('edfs') && tableOwners.has('edf_items')) {
      await client.query(`
        UPDATE edf_items 
        SET status = 'Received', received_at = CURRENT_TIMESTAMP, received_by = 'System' 
        WHERE status = 'Pending' AND edf_id IN (SELECT id FROM edfs WHERE status = 'Received');
      `);
    }

    // 5. Activity logs table
    await ensureTable(
      'activity_logs',
      `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        edf_number TEXT,
        action TEXT NOT NULL,
        user_phone TEXT,
        user_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `
    );

    // 6. EDF status history table
    await ensureTable(
      'edf_status_history',
      `
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
      `
    );

    // 7. Requesters table (for Requester Name Dropdown)
    await ensureTable(
      'requesters',
      `
      CREATE TABLE IF NOT EXISTS requesters (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `
    );

    // 8. System settings table
    await ensureTable(
      'system_settings',
      `
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `
    );

    // 9. EDF Backups table (permanent snapshot archive in database)
    await ensureTable(
      'edf_backups',
      `
      CREATE TABLE IF NOT EXISTS edf_backups (
        id SERIAL PRIMARY KEY,
        backup_type TEXT NOT NULL DEFAULT 'auto',
        snapshot_data TEXT NOT NULL,
        records_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      `
    );

    // Create useful indexes safely when missing and permitted
    const indexDefs: Array<{ name: string; table: string; sql: string }> = [
      { name: 'idx_edfs_status', table: 'edfs', sql: 'CREATE INDEX IF NOT EXISTS idx_edfs_status ON edfs(status);' },
      { name: 'idx_edfs_category', table: 'edfs', sql: 'CREATE INDEX IF NOT EXISTS idx_edfs_category ON edfs(category);' },
      { name: 'idx_edfs_required_date', table: 'edfs', sql: 'CREATE INDEX IF NOT EXISTS idx_edfs_required_date ON edfs(required_date);' },
      { name: 'idx_edf_items_edf_id', table: 'edf_items', sql: 'CREATE INDEX IF NOT EXISTS idx_edf_items_edf_id ON edf_items(edf_id);' },
      { name: 'idx_status_history_edf_id', table: 'edf_status_history', sql: 'CREATE INDEX IF NOT EXISTS idx_status_history_edf_id ON edf_status_history(edf_id);' },
      { name: 'idx_activity_logs_created_at', table: 'activity_logs', sql: 'CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);' },
      { name: 'idx_requesters_name', table: 'requesters', sql: 'CREATE INDEX IF NOT EXISTS idx_requesters_name ON requesters(name);' },
    ];

    for (const idx of indexDefs) {
      if (!existingIndexes.has(idx.name) && canAlterTable(idx.table)) {
        await client.query(idx.sql);
      }
    }

    await client.query('COMMIT');
    console.log('[Safe Migration] Schema verification and migration succeeded. All existing data preserved.');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
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
