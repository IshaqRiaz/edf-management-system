import { EDF } from '../types.ts';

const BROWSER_BACKUP_KEY = 'edf_browser_backup_dataset';
const BACKUP_HISTORY_KEY = 'edf_browser_backup_history';

export interface LocalBackupSnapshot {
  id: string;
  timestamp: string;
  count: number;
  data: EDF[];
  notes?: string;
}

/**
 * Automatically snapshots the current EDF dataset to browser localStorage
 */
export function saveBrowserBackup(edfs: EDF[], notes?: string): boolean {
  if (!Array.isArray(edfs) || edfs.length === 0) return false;
  try {
    const snapshot: LocalBackupSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: new Date().toISOString(),
      count: edfs.length,
      data: edfs,
      notes: notes || 'Automated client snapshot',
    };

    localStorage.setItem(BROWSER_BACKUP_KEY, JSON.stringify(snapshot));

    // Keep history of last 5 snapshots
    let history: LocalBackupSnapshot[] = [];
    try {
      const stored = localStorage.getItem(BACKUP_HISTORY_KEY);
      if (stored) history = JSON.parse(stored);
    } catch {}

    const updatedHistory = [snapshot, ...history.filter((s) => s.id !== snapshot.id)].slice(0, 5);
    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(updatedHistory));
    return true;
  } catch (err) {
    console.warn('Browser backup storage warning:', err);
    return false;
  }
}

/**
 * Retrieves the latest browser backup snapshot
 */
export function getLatestBrowserBackup(): LocalBackupSnapshot | null {
  try {
    const stored = localStorage.getItem(BROWSER_BACKUP_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

/**
 * Downloads a complete JSON snapshot file of the current dataset
 */
export function downloadBackupFile(edfs: EDF[], filename?: string): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    system: 'EDF Management System',
    totalRecords: edfs.length,
    edfs,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `EDF_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
