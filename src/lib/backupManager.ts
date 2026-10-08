import fs from 'fs';
import path from 'path';
import { db } from '../db/index.ts';
import {
  edfs,
  edfItems,
  edfStatusHistory,
  categories,
  requesters,
  activityLogs,
  edfBackups,
  systemSettings,
} from '../db/schema.ts';
import { desc } from 'drizzle-orm';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'edf_permanent_store.json');
const BACKUPS_HISTORY_DIR = path.join(DATA_DIR, 'backups');

// Ensure data and backup directories exist
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_HISTORY_DIR)) {
    fs.mkdirSync(BACKUPS_HISTORY_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[Persistence Manager] Directory creation notice:', err);
}

export interface BackupData {
  version: number;
  timestamp: string;
  backupType?: string;
  edfs: any[];
  edfItems: any[];
  edfStatusHistory: any[];
  categories: any[];
  requesters: any[];
  activityLogs: any[];
}

/**
 * Checks whether user data already exists in any storage layer.
 */
export async function isUserDataPresent(): Promise<boolean> {
  try {
    const existing = await db.select().from(edfs).limit(1);
    if (existing.length > 0) return true;

    // Check system_settings
    const setting = await db
      .select()
      .from(systemSettings)
      .where(desc(systemSettings.updatedAt))
      .limit(10);
    const hasSeedMark = setting.some((s) => s.key === 'seed_completed' && s.value === 'true');
    if (hasSeedMark) return true;

    // Check disk file
    if (fs.existsSync(BACKUP_FILE)) {
      const content = fs.readFileSync(BACKUP_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed?.edfs) && parsed.edfs.length > 0) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn('[Persistence Manager] Error checking user data presence:', error);
    return false;
  }
}

/**
 * Creates a permanent snapshot of all application data to both Cloud SQL and persistent disk.
 * Called automatically after EVERY create, update, delete, or import operation.
 */
export async function takeDatabaseBackup(backupType: 'auto' | 'pre_update' | 'manual' = 'auto'): Promise<boolean> {
  try {
    const [allEdfs, allItems, allHistory, allCats, allReqs, allLogs] = await Promise.all([
      db.select().from(edfs),
      db.select().from(edfItems),
      db.select().from(edfStatusHistory),
      db.select().from(categories),
      db.select().from(requesters),
      db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(200),
    ]);

    const backupPayload: BackupData = {
      version: 1,
      timestamp: new Date().toISOString(),
      backupType,
      edfs: allEdfs,
      edfItems: allItems,
      edfStatusHistory: allHistory,
      categories: allCats,
      requesters: allReqs,
      activityLogs: allLogs,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);

    // 1. Write to primary persistent store file
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(BACKUP_FILE, jsonString, 'utf-8');

      // 2. Rolling timestamped backup in /data/backups/
      if (!fs.existsSync(BACKUPS_HISTORY_DIR)) {
        fs.mkdirSync(BACKUPS_HISTORY_DIR, { recursive: true });
      }
      const safeTime = new Date().toISOString().replace(/[:.]/g, '-');
      const rollingFile = path.join(BACKUPS_HISTORY_DIR, `backup_${safeTime}.json`);
      fs.writeFileSync(rollingFile, jsonString, 'utf-8');

      // Prune rolling backups to keep newest 10
      const files = fs.readdirSync(BACKUPS_HISTORY_DIR).filter((f) => f.endsWith('.json'));
      if (files.length > 10) {
        files.sort();
        for (let i = 0; i < files.length - 10; i++) {
          try {
            fs.unlinkSync(path.join(BACKUPS_HISTORY_DIR, files[i]));
          } catch (e) {}
        }
      }
    } catch (fsErr) {
      console.warn('[Persistence Manager] Disk backup write error:', fsErr);
    }

    // 3. Write snapshot into SQL edf_backups table
    if (allEdfs.length > 0) {
      await db.insert(edfBackups).values({
        backupType,
        snapshotData: jsonString,
        recordsCount: allEdfs.length,
      });

      // Mark seed completed permanently
      await db
        .insert(systemSettings)
        .values({
          key: 'seed_completed',
          value: 'true',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: 'true', updatedAt: new Date() },
        });

      await db
        .insert(systemSettings)
        .values({
          key: 'last_backup_at',
          value: new Date().toISOString(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: new Date().toISOString(), updatedAt: new Date() },
        });
    }

    return true;
  } catch (error) {
    console.error('[Persistence Manager] Error taking database backup:', error);
    return false;
  }
}

/**
 * Restores data from persistent storage if Cloud SQL database was ever reset or started empty.
 */
export async function restoreFromBackupIfNeeded(): Promise<boolean> {
  try {
    const existingEdfs = await db.select().from(edfs).limit(1);

    // If database already contains EDFs, never overwrite them!
    if (existingEdfs.length > 0) {
      await db
        .insert(systemSettings)
        .values({
          key: 'seed_completed',
          value: 'true',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: 'true', updatedAt: new Date() },
        });

      // Take a backup sync so current state is permanently preserved
      await takeDatabaseBackup('auto');
      return true;
    }

    // Database is empty. Locate the latest backup to restore.
    let backupToRestore: BackupData | null = null;

    // Check Cloud SQL edf_backups table first
    try {
      const latestDbBackup = await db
        .select()
        .from(edfBackups)
        .orderBy(desc(edfBackups.id))
        .limit(1);

      if (latestDbBackup.length > 0 && latestDbBackup[0].snapshotData) {
        backupToRestore = JSON.parse(latestDbBackup[0].snapshotData);
      }
    } catch (dbErr) {
      console.warn('[Persistence Manager] Notice checking DB backup table:', dbErr);
    }

    // Fallback 1: Primary persistent store file on disk
    if (!backupToRestore && fs.existsSync(BACKUP_FILE)) {
      try {
        const fileContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
        backupToRestore = JSON.parse(fileContent);
      } catch (e) {
        console.error('[Persistence Manager] Error reading primary backup file:', e);
      }
    }

    // Fallback 2: Check rolling backups folder
    if (!backupToRestore && fs.existsSync(BACKUPS_HISTORY_DIR)) {
      try {
        const files = fs.readdirSync(BACKUPS_HISTORY_DIR).filter((f) => f.endsWith('.json')).sort().reverse();
        if (files.length > 0) {
          const content = fs.readFileSync(path.join(BACKUPS_HISTORY_DIR, files[0]), 'utf-8');
          backupToRestore = JSON.parse(content);
        }
      } catch (e) {
        console.error('[Persistence Manager] Error reading rolling backup file:', e);
      }
    }

    // If valid backup found, restore records
    if (backupToRestore && Array.isArray(backupToRestore.edfs) && backupToRestore.edfs.length > 0) {
      console.log(`[Persistence Manager] Restoring ${backupToRestore.edfs.length} EDF records from backup...`);

      // 1. Restore categories
      if (Array.isArray(backupToRestore.categories)) {
        for (const cat of backupToRestore.categories) {
          await db
            .insert(categories)
            .values({
              name: cat.name,
              description: cat.description,
              icon: cat.icon,
            })
            .onConflictDoNothing();
        }
      }

      // 2. Restore requesters
      if (Array.isArray(backupToRestore.requesters)) {
        for (const req of backupToRestore.requesters) {
          await db
            .insert(requesters)
            .values({ name: req.name })
            .onConflictDoNothing();
        }
      }

      // 3. Restore EDFs and items
      const edfIdMap: Record<number, number> = {};
      for (const edf of backupToRestore.edfs) {
        const [inserted] = await db
          .insert(edfs)
          .values({
            edfNumber: edf.edfNumber,
            requesterName: edf.requesterName,
            category: edf.category,
            issueDate: new Date(edf.issueDate),
            requiredDate: new Date(edf.requiredDate),
            materialList: edf.materialList,
            quantity: edf.quantity || 1,
            unit: edf.unit || 'pcs',
            status: edf.status || 'Pending',
            remarks: edf.remarks,
            createdBy: edf.createdBy,
            createdAt: edf.createdAt ? new Date(edf.createdAt) : new Date(),
            updatedAt: edf.updatedAt ? new Date(edf.updatedAt) : new Date(),
          })
          .onConflictDoNothing()
          .returning();

        if (inserted) {
          edfIdMap[edf.id] = inserted.id;
        }
      }

      // 4. Restore items
      if (Array.isArray(backupToRestore.edfItems)) {
        for (const item of backupToRestore.edfItems) {
          const targetEdfId = edfIdMap[item.edfId] || item.edfId;
          if (targetEdfId) {
            await db
              .insert(edfItems)
              .values({
                edfId: targetEdfId,
                itemDescription: item.itemDescription,
                quantity: item.quantity,
                unit: item.unit,
                status: item.status || 'Pending',
                receivedAt: item.receivedAt ? new Date(item.receivedAt) : null,
                receivedBy: item.receivedBy || null,
              })
              .catch(() => {});
          }
        }
      }

      // 5. Restore status history
      if (Array.isArray(backupToRestore.edfStatusHistory)) {
        for (const hist of backupToRestore.edfStatusHistory) {
          const targetEdfId = edfIdMap[hist.edfId] || hist.edfId;
          if (targetEdfId) {
            await db
              .insert(edfStatusHistory)
              .values({
                edfId: targetEdfId,
                edfNumber: hist.edfNumber,
                fromStatus: hist.fromStatus,
                toStatus: hist.toStatus,
                changedBy: hist.changedBy,
                notes: hist.notes,
                createdAt: hist.createdAt ? new Date(hist.createdAt) : new Date(),
              })
              .catch(() => {});
          }
        }
      }

      // 6. Restore activity logs
      if (Array.isArray(backupToRestore.activityLogs)) {
        for (const log of backupToRestore.activityLogs) {
          await db
            .insert(activityLogs)
            .values({
              edfNumber: log.edfNumber,
              action: log.action,
              userPhone: log.userPhone,
              userName: log.userName,
              createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
            })
            .catch(() => {});
        }
      }

      await db
        .insert(systemSettings)
        .values({
          key: 'seed_completed',
          value: 'true',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: 'true', updatedAt: new Date() },
        });

      console.log('[Persistence Manager] Restoration from backup completed successfully.');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Persistence Manager] Error during restoreFromBackupIfNeeded:', error);
    return false;
  }
}

/**
 * Returns diagnostic metadata about backup status.
 */
export async function getBackupStatus(): Promise<{
  lastBackupAt: string | null;
  totalEdfs: number;
  diskBackupExists: boolean;
  historyBackupsCount: number;
}> {
  try {
    const [edfCount, lastSetting] = await Promise.all([
      db.select().from(edfs),
      db.select().from(systemSettings).where(desc(systemSettings.updatedAt)),
    ]);

    const backupSetting = lastSetting.find((s) => s.key === 'last_backup_at');
    const diskExists = fs.existsSync(BACKUP_FILE);
    let historyCount = 0;
    if (fs.existsSync(BACKUPS_HISTORY_DIR)) {
      historyCount = fs.readdirSync(BACKUPS_HISTORY_DIR).filter((f) => f.endsWith('.json')).length;
    }

    return {
      lastBackupAt: backupSetting ? backupSetting.value : null,
      totalEdfs: edfCount.length,
      diskBackupExists: diskExists,
      historyBackupsCount: historyCount,
    };
  } catch (error) {
    return {
      lastBackupAt: null,
      totalEdfs: 0,
      diskBackupExists: false,
      historyBackupsCount: 0,
    };
  }
}
