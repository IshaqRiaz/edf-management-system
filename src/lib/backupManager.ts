import fs from 'fs';
import path from 'path';
import { db } from '../db/index.ts';
import { edfs, edfItems, edfStatusHistory, categories, requesters, activityLogs, edfBackups, systemSettings } from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';

const BACKUP_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_FILE = path.join(BACKUP_DIR, 'edf_permanent_store.json');

// Ensure data directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create data directory:', err);
  }
}

export interface BackupData {
  version: number;
  timestamp: string;
  edfs: any[];
  edfItems: any[];
  edfStatusHistory: any[];
  categories: any[];
  requesters: any[];
  activityLogs: any[];
}

/**
 * Creates a permanent snapshot of all data to both Cloud SQL and disk.
 */
export async function takeDatabaseBackup(backupType: 'auto' | 'pre_update' | 'manual' = 'auto'): Promise<boolean> {
  try {
    const [allEdfs, allItems, allHistory, allCats, allReqs, allLogs] = await Promise.all([
      db.select().from(edfs),
      db.select().from(edfItems),
      db.select().from(edfStatusHistory),
      db.select().from(categories),
      db.select().from(requesters),
      db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(100),
    ]);

    const backupPayload: BackupData = {
      version: 1,
      timestamp: new Date().toISOString(),
      edfs: allEdfs,
      edfItems: allItems,
      edfStatusHistory: allHistory,
      categories: allCats,
      requesters: allReqs,
      activityLogs: allLogs,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);

    // 1. Write to local file backup
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      fs.writeFileSync(BACKUP_FILE, jsonString, 'utf-8');
    } catch (fsErr) {
      console.warn('File backup write warning:', fsErr);
    }

    // 2. Write to Cloud SQL edf_backups table
    if (allEdfs.length > 0) {
      await db.insert(edfBackups).values({
        backupType,
        snapshotData: jsonString,
        recordsCount: allEdfs.length,
      });

      // Update system settings to mark seed completed so sample data never reloads
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
    console.error('Error during takeDatabaseBackup:', error);
    return false;
  }
}

/**
 * Restores data from persistent storage if Cloud SQL was ever reset.
 */
export async function restoreFromBackupIfNeeded(): Promise<boolean> {
  try {
    const existingEdfs = await db.select().from(edfs).limit(1);

    // If database already contains EDFs, ensure seed_completed is marked and sync backup
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

      // Take sync backup
      await takeDatabaseBackup('auto');
      return true;
    }

    // Database is empty. Check if a backup exists in edf_backups table or disk!
    let backupToRestore: BackupData | null = null;

    // Check Cloud SQL edf_backups table
    const latestDbBackup = await db
      .select()
      .from(edfBackups)
      .orderBy(desc(edfBackups.id))
      .limit(1);

    if (latestDbBackup.length > 0 && latestDbBackup[0].snapshotData) {
      try {
        backupToRestore = JSON.parse(latestDbBackup[0].snapshotData);
      } catch (e) {
        console.error('Error parsing DB snapshot:', e);
      }
    }

    // Fallback: Check disk file
    if (!backupToRestore && fs.existsSync(BACKUP_FILE)) {
      try {
        const fileContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
        backupToRestore = JSON.parse(fileContent);
      } catch (e) {
        console.error('Error parsing file backup:', e);
      }
    }

    if (backupToRestore && Array.isArray(backupToRestore.edfs) && backupToRestore.edfs.length > 0) {
      console.log(`[Persistence Manager] Restoring ${backupToRestore.edfs.length} EDFs from permanent backup...`);

      // Restore categories
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

      // Restore requesters
      if (Array.isArray(backupToRestore.requesters)) {
        for (const req of backupToRestore.requesters) {
          await db
            .insert(requesters)
            .values({ name: req.name })
            .onConflictDoNothing();
        }
      }

      // Restore EDFs and items
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
            priority: edf.priority || 'Medium',
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

      // Restore items
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
              })
              .catch(() => {});
          }
        }
      }

      // Restore status history
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

      // Restore activity logs
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

      console.log('[Persistence Manager] Restoration completed successfully.');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error during restoreFromBackupIfNeeded:', error);
    return false;
  }
}
