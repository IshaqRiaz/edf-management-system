// IndexedDB Offline Storage and Sync Engine for EDF Management System
import { EDF, Category, DashboardStats, User, EDFStatusHistory } from '../types.ts';

const DB_NAME = 'edf_system_db';
const DB_VERSION = 2;

export interface SyncQueueItem {
  id: string; // unique uuid or timestamp
  action: 'create' | 'update' | 'delete' | 'mark-status' | 'receive-items' | 'undo-item-received' | 'bulk-action' | 'user-action';
  payload: any;
  timestamp: number;
}

// Open or initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Store for EDF records
      if (!db.objectStoreNames.contains('edfs')) {
        const edfStore = db.createObjectStore('edfs', { keyPath: 'id' });
        edfStore.createIndex('edfNumber', 'edfNumber', { unique: false });
        edfStore.createIndex('status', 'status', { unique: false });
        edfStore.createIndex('category', 'category', { unique: false });
      }

      // 2. Store for categories
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }

      // 3. Store for key-value system state (dashboard stats, metadata)
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }

      // 4. Store for pending synchronization actions
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }

      // 5. Store for users list (offline viewing and management)
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }

      // 6. Store for audit history logs
      if (!db.objectStoreNames.contains('audit_logs')) {
        db.createObjectStore('audit_logs', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Generic transaction helpers
async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<{ store: IDBObjectStore; tx: IDBTransaction }> {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  return { store, tx };
}

// ============================================================================
// 1. EDF STORAGE OPERATIONS
// ============================================================================

export async function saveLocalEDFs(incomingEdfs: EDF[]): Promise<void> {
  try {
    // 1. Check existing records and pending sync actions to avoid overwriting offline creations
    const existing = await getLocalEDFs();
    const queue = await getSyncQueue();

    const pendingIds = new Set<number>();
    const pendingNumbers = new Set<string>();

    for (const q of queue) {
      if (q.action === 'create' && q.payload) {
        if (q.payload.id) pendingIds.add(q.payload.id);
        if (q.payload.edfNumber) pendingNumbers.add(q.payload.edfNumber);
      } else if (q.action === 'update' && q.payload?.id) {
        pendingIds.add(q.payload.id);
      }
    }

    // Preserve any local records created offline that have not yet synced with server
    const pendingOfflineRecords = existing.filter((e) => {
      const isPending = pendingIds.has(e.id) || (e.edfNumber && pendingNumbers.has(e.edfNumber));
      const isTempId = e.id > 100000000000; // Local timestamp-based ID
      const notInIncoming = !incomingEdfs.some(
        (inc) => inc.id === e.id || (e.edfNumber && inc.edfNumber === e.edfNumber)
      );
      return (isPending || isTempId) && notInIncoming;
    });

    const mergedList = [...incomingEdfs, ...pendingOfflineRecords];

    const { store, tx } = await getStore('edfs', 'readwrite');
    const clearReq = store.clear();
    await new Promise((res, rej) => {
      clearReq.onsuccess = res;
      clearReq.onerror = rej;
    });

    for (const item of mergedList) {
      store.put(item);
    }

    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to save EDFs to IndexedDB:', err);
  }
}

export async function getLocalEDFs(): Promise<EDF[]> {
  try {
    const { store } = await getStore('edfs', 'readonly');
    const req = store.getAll();
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  } catch (err) {
    console.error('Failed to read local EDFs:', err);
    return [];
  }
}

export async function upsertLocalEDF(edf: EDF): Promise<void> {
  try {
    const { store, tx } = await getStore('edfs', 'readwrite');
    store.put(edf);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to upsert local EDF:', err);
  }
}

export async function deleteLocalEDF(id: number): Promise<void> {
  try {
    const { store, tx } = await getStore('edfs', 'readwrite');
    store.delete(id);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to delete local EDF:', err);
  }
}

// ============================================================================
// 2. CATEGORIES STORAGE
// ============================================================================

export async function saveLocalCategories(categories: Category[]): Promise<void> {
  try {
    const { store, tx } = await getStore('categories', 'readwrite');
    store.clear();
    for (const cat of categories) {
      store.put(cat);
    }
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to save local categories:', err);
  }
}

export async function getLocalCategories(): Promise<Category[]> {
  try {
    const { store } = await getStore('categories', 'readonly');
    const req = store.getAll();
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  } catch (err) {
    console.error('Failed to read local categories:', err);
    return [];
  }
}

// ============================================================================
// 3. META / STATS STORAGE
// ============================================================================

export async function saveLocalStats(stats: DashboardStats): Promise<void> {
  try {
    const { store, tx } = await getStore('meta', 'readwrite');
    store.put({ key: 'dashboard_stats', value: stats });
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to save local stats:', err);
  }
}

export async function getLocalStats(): Promise<DashboardStats | null> {
  try {
    const { store } = await getStore('meta', 'readonly');
    const req = store.get('dashboard_stats');
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result?.value || null);
      req.onerror = () => rej(req.error);
    });
  } catch (err) {
    console.error('Failed to read local stats:', err);
    return null;
  }
}

// ============================================================================
// 4. SYNC QUEUE OPERATIONS (Offline Change Tracking)
// ============================================================================

export async function enqueueSyncAction(
  action: SyncQueueItem['action'],
  payload: any
): Promise<string> {
  const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const item: SyncQueueItem = {
    id,
    action,
    payload,
    timestamp: Date.now(),
  };

  try {
    const { store, tx } = await getStore('sync_queue', 'readwrite');
    store.put(item);
    await new Promise((res, rej) => {
      tx.oncomplete = () => res(null);
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to enqueue sync action:', err);
  }

  return id;
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const { store } = await getStore('sync_queue', 'readonly');
    const req = store.getAll();
    return new Promise((res, rej) => {
      req.onsuccess = () => {
        const items = (req.result || []) as SyncQueueItem[];
        items.sort((a, b) => a.timestamp - b.timestamp);
        res(items);
      };
      req.onerror = () => rej(req.error);
    });
  } catch (err) {
    console.error('Failed to get sync queue:', err);
    return [];
  }
}

export async function removeSyncAction(id: string): Promise<void> {
  try {
    const { store, tx } = await getStore('sync_queue', 'readwrite');
    store.delete(id);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to remove sync action:', err);
  }
}

export async function clearSyncQueue(): Promise<void> {
  try {
    const { store, tx } = await getStore('sync_queue', 'readwrite');
    store.clear();
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to clear sync queue:', err);
  }
}

// Remap temporary offline ID to real server database ID in the sync queue
export async function remapSyncQueueId(oldId: number, newId: number): Promise<void> {
  try {
    const { store, tx } = await getStore('sync_queue', 'readwrite');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []) as SyncQueueItem[];
      for (const item of items) {
        let changed = false;
        if (item.payload) {
          if (item.payload.id === oldId) {
            item.payload.id = newId;
            changed = true;
          }
          if (item.payload.edfId === oldId) {
            item.payload.edfId = newId;
            changed = true;
          }
          if (Array.isArray(item.payload.ids)) {
            item.payload.ids = item.payload.ids.map((id: number) => (id === oldId ? newId : id));
            changed = true;
          }
        }
        if (changed) {
          store.put(item);
        }
      }
    };
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to remap sync queue ID:', err);
  }
}

// ============================================================================
// 5. USERS STORAGE (Offline User Directory)
// ============================================================================

export async function saveLocalUsers(usersList: User[]): Promise<void> {
  try {
    const { store, tx } = await getStore('users', 'readwrite');
    store.clear();
    for (const u of usersList) {
      store.put(u);
    }
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to save local users:', err);
  }
}

export async function getLocalUsers(): Promise<User[]> {
  try {
    const { store } = await getStore('users', 'readonly');
    const req = store.getAll();
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  } catch (err) {
    console.error('Failed to read local users:', err);
    return [];
  }
}

// ============================================================================
// 6. AUDIT LOGS STORAGE (Offline Forensic History)
// ============================================================================

export async function saveLocalAuditLogs(logs: EDFStatusHistory[]): Promise<void> {
  try {
    const { store, tx } = await getStore('audit_logs', 'readwrite');
    store.clear();
    for (const log of logs) {
      if (log.id !== undefined) {
        store.put(log);
      }
    }
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Failed to save local audit logs:', err);
  }
}

export async function getLocalAuditLogs(): Promise<EDFStatusHistory[]> {
  try {
    const { store } = await getStore('audit_logs', 'readonly');
    const req = store.getAll();
    return new Promise((res, rej) => {
      req.onsuccess = () => {
        const result = (req.result || []) as EDFStatusHistory[];
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res(result);
      };
      req.onerror = () => rej(req.error);
    });
  } catch (err) {
    console.error('Failed to read local audit logs:', err);
    return [];
  }
}

// Compute client-side stats from local EDF array (for offline dashboard calculations)
export function computeStatsFromEDFs(edfs: EDF[]): DashboardStats {
  const stats: DashboardStats = {
    total: edfs.length,
    hvac: 0,
    plumbing: 0,
    generator: 0,
    telephone: 0,
    electrical: 0,
    general: 0,
    pending: 0,
    partiallyReceived: 0,
    received: 0,
    overdue: 0,
    recentActivity: [],
    categoryDistribution: [],
    statusDistribution: [],
  };

  const categoryMap: Record<string, number> = {};
  const statusMap: Record<string, number> = {
    Pending: 0,
    'Partially Received': 0,
    Received: 0,
    Overdue: 0,
  };

  const now = new Date();

  for (const edf of edfs) {
    // Categories
    const cat = edf.category || 'General';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    const lowerCat = cat.toLowerCase();
    if (lowerCat.includes('hvac')) stats.hvac++;
    else if (lowerCat.includes('plumb')) stats.plumbing++;
    else if (lowerCat.includes('gen')) stats.generator++;
    else if (lowerCat.includes('tele')) stats.telephone++;
    else if (lowerCat.includes('elect')) stats.electrical++;
    else stats.general++;

    // Items calculation
    const rawItems = edf.items || [];
    const totalCount = edf.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
    const recCount = edf.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;

    // Check overdue
    const reqDate = new Date(edf.requiredDate);
    const isOverdue = edf.status !== 'Received' && reqDate.getTime() < now.getTime();
    if (isOverdue) stats.overdue++;

    if (edf.status === 'Received' || (recCount >= totalCount && totalCount > 0)) {
      stats.received++;
      statusMap['Received']++;
    } else if (edf.status === 'Partially Received' || (recCount > 0 && recCount < totalCount)) {
      stats.partiallyReceived++;
      statusMap['Partially Received']++;
    } else {
      stats.pending++;
      statusMap['Pending']++;
    }
  }

  stats.categoryDistribution = Object.entries(categoryMap).map(([name, count]) => ({
    name,
    count,
  }));

  const statusColorMap: Record<string, string> = {
    Pending: '#f59e0b',
    'Partially Received': '#0ea5e9',
    Received: '#10b981',
    Overdue: '#f43f5e',
  };

  stats.statusDistribution = Object.entries(statusMap).map(([name, count]) => ({
    name,
    count,
    color: statusColorMap[name] || '#94a3b8',
  }));

  return stats;
}
