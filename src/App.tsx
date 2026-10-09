import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { EDF, Category, DashboardStats, ActivityLog } from './types.ts';
import { LoginModal } from './components/LoginModal.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { EDFList } from './components/EDFList.tsx';
import { OverdueSection } from './components/OverdueSection.tsx';
import { ExcelImport } from './components/ExcelImport.tsx';
import { CreateEditEDFModal } from './components/CreateEditEDFModal.tsx';
import { EDFDetailsModal } from './components/EDFDetailsModal.tsx';
import { UserManager } from './components/UserManager.tsx';
import { Reports } from './components/Reports.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { KanbanBoard } from './components/KanbanBoard.tsx';
import { AuditLog } from './components/AuditLog.tsx';
import { AlertCircle, RefreshCw } from 'lucide-react';
import {
  saveLocalEDFs,
  getLocalEDFs,
  upsertLocalEDF,
  deleteLocalEDF,
  saveLocalCategories,
  getLocalCategories,
  saveLocalStats,
  getLocalStats,
  enqueueSyncAction,
  getSyncQueue,
  removeSyncAction,
  remapSyncQueueId,
  computeStatsFromEDFs,
  SyncQueueItem,
} from './utils/offlineStorage.ts';
import { useOnlineStatus } from './hooks/useOnlineStatus.ts';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';

const initialStats: DashboardStats = {
  total: 0,
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

const MainLayout: React.FC = () => {
  const { user, token, isAdmin, isLoading: authLoading, updateUser } = useAuth();
  const isOnline = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // App Data State
  const [edfs, setEdfs] = useState<EDF[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [isLoading, setIsLoading] = useState(true);

  // Sync Queue Tracking
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef(false);

  // Modals
  const [viewingEdf, setViewingEdf] = useState<EDF | null>(null);
  const [editingEdf, setEditingEdf] = useState<EDF | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Navigation Filter presets from Dashboard clicks
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState<boolean>(false);

  // In-app Toast Notification State (Avoids window.alert)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  // Update sync count from local queue
  const refreshSyncCount = useCallback(async () => {
    const queue = await getSyncQueue();
    setPendingSyncCount(queue.length);
  }, []);

  // Resilient fetch helper with automatic retry for smooth server transitions
  const fetchWithRetry = useCallback(async (url: string, retries = 1): Promise<any> => {
    if (!token) return null;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return fetchWithRetry(url, retries - 1);
      }
      return null;
    }
  }, [token]);

  // Load local IndexedDB cache initially so app opens immediately offline or online
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [cachedEdfs, cachedCats, cachedStats] = await Promise.all([
          getLocalEDFs(),
          getLocalCategories(),
          getLocalStats(),
        ]);
        if (!isMounted) return;
        if (cachedEdfs && cachedEdfs.length > 0) {
          setEdfs(cachedEdfs);
        }
        if (cachedCats && cachedCats.length > 0) {
          setCategories(cachedCats);
        }
        if (cachedStats) {
          setStats(cachedStats);
        } else if (cachedEdfs && cachedEdfs.length > 0) {
          setStats(computeStatsFromEDFs(cachedEdfs));
        }
        await refreshSyncCount();
      } catch (err) {
        console.warn('Initial IndexedDB cache read:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshSyncCount]);

  // Fetch all EDFs from server, with fallback to IndexedDB
  const fetchEDFs = useCallback(async () => {
    if (!isOnline && typeof navigator !== 'undefined' && !navigator.onLine) {
      const local = await getLocalEDFs();
      if (local && local.length > 0) setEdfs(local);
      return;
    }

    const data = await fetchWithRetry('/api/edfs');
    if (Array.isArray(data)) {
      setEdfs(data);
      // Persist latest state to IndexedDB
      await saveLocalEDFs(data);
    } else {
      // Fallback to IndexedDB
      const local = await getLocalEDFs();
      if (local && local.length > 0) setEdfs(local);
    }
  }, [fetchWithRetry, isOnline]);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    if (!isOnline && typeof navigator !== 'undefined' && !navigator.onLine) {
      const localEdfs = await getLocalEDFs();
      const calculated = computeStatsFromEDFs(localEdfs);
      setStats(calculated);
      return;
    }

    const data = await fetchWithRetry('/api/dashboard/stats');
    if (data && typeof data === 'object') {
      setStats(data);
      await saveLocalStats(data);
    } else {
      const localEdfs = await getLocalEDFs();
      const calculated = computeStatsFromEDFs(localEdfs);
      setStats(calculated);
    }
  }, [fetchWithRetry, isOnline]);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    const data = await fetchWithRetry('/api/categories');
    if (Array.isArray(data)) {
      setCategories(data);
      await saveLocalCategories(data);
    } else {
      const localCats = await getLocalCategories();
      if (localCats && localCats.length > 0) setCategories(localCats);
    }
  }, [fetchWithRetry]);

  // Sync queued offline changes with the server
  const processSyncQueue = useCallback(async () => {
    if (!token || !isOnline || isSyncingRef.current) return;
    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    let syncedCount = 0;
    try {
      for (const item of queue) {
        try {
          let success = false;
          if (item.action === 'create') {
            const res = await fetch('/api/edfs', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(item.payload),
            });
            if (res.ok) {
              const created = await res.json();
              const localTempId = item.payload?.id;
              if (localTempId && created?.id && localTempId !== created.id) {
                await remapSyncQueueId(localTempId, created.id);
              }
              success = true;
            } else if (res.status === 409 || res.status === 400) {
              // 409/400 (already exists) is safe to treat as synced
              success = true;
            }
          } else if (item.action === 'update') {
            const res = await fetch(`/api/edfs/${item.payload.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(item.payload.data),
            });
            success = res.ok;
          } else if (item.action === 'delete') {
            const res = await fetch(`/api/edfs/${item.payload.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            success = res.ok || res.status === 404;
          } else if (item.action === 'mark-status') {
            const res = await fetch(`/api/edfs/${item.payload.id}/mark-status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ status: item.payload.status }),
            });
            success = res.ok;
          } else if (item.action === 'receive-items') {
            const res = await fetch(`/api/edfs/${item.payload.edfId}/receive-items`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ itemIds: item.payload.itemIds }),
            });
            success = res.ok;
          } else if (item.action === 'undo-item-received') {
            const res = await fetch(`/api/edfs/${item.payload.edfId}/undo-item-received`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ itemId: item.payload.itemId }),
            });
            success = res.ok;
          } else if (item.action === 'bulk-action') {
            const res = await fetch('/api/edfs/bulk-action', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(item.payload),
            });
            success = res.ok;
          }

          if (success) {
            await removeSyncAction(item.id);
            syncedCount++;
          }
        } catch (itemErr) {
          console.error('Error syncing item:', item.id, itemErr);
          break; // Stop sync loop if connection broke mid-way
        }
      }

      await refreshSyncCount();
      if (syncedCount > 0) {
        showToast(`Synced ${syncedCount} offline change${syncedCount > 1 ? 's' : ''} to database!`, 'success');
        // Refresh truth from server after syncing
        await Promise.all([fetchEDFs(), fetchStats(), fetchCategories()]);
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [token, isOnline, refreshSyncCount, showToast, fetchEDFs, fetchStats, fetchCategories]);

  // When internet reconnects, automatically flush the sync queue
  useEffect(() => {
    if (isOnline && token) {
      processSyncQueue();
    }
  }, [isOnline, token, processSyncQueue]);

  // Refresh all application data
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const refreshAllData = useCallback(async (isManual = false) => {
    if (isManual) setIsManualRefreshing(true);
    else setIsLoading(true);
    await Promise.all([fetchEDFs(), fetchStats(), fetchCategories()]);
    await refreshSyncCount();
    if (isManual) setIsManualRefreshing(false);
    else setIsLoading(false);
  }, [fetchEDFs, fetchStats, fetchCategories, refreshSyncCount]);

  useEffect(() => {
    if (token) {
      refreshAllData(false);
    }
  }, [token, refreshAllData]);

  // Periodic subtle background poll when online
  useEffect(() => {
    if (!token || !isOnline) return;
    const interval = setInterval(() => {
      fetchEDFs();
      fetchStats();
      processSyncQueue();
    }, 5000);
    return () => clearInterval(interval);
  }, [token, isOnline, fetchEDFs, fetchStats, processSyncQueue]);

  // Handle Dashboard Click Navigation to Filtered Records
  const handleFilterNavigate = (
    filterType: 'category' | 'status' | 'all' | 'overdue',
    value?: string
  ) => {
    if (filterType === 'all') {
      setFilterCategory('All');
      setFilterStatus('All');
      setFilterOverdueOnly(false);
      setActiveTab('edfs');
    } else if (filterType === 'category') {
      setFilterCategory(value || 'All');
      setFilterStatus('All');
      setFilterOverdueOnly(false);
      setActiveTab('edfs');
    } else if (filterType === 'status') {
      setFilterCategory('All');
      setFilterStatus(value || 'All');
      setFilterOverdueOnly(false);
      setActiveTab('edfs');
    } else if (filterType === 'overdue') {
      setActiveTab('overdue');
    }
  };

  // Create EDF (Works online and offline)
  const handleSaveNewEDF = async (payload: any): Promise<boolean> => {
    const isNetworkOnline = isOnline && typeof navigator !== 'undefined' && navigator.onLine;

    // Create optimistic local record with unique ID
    const newLocalId = payload.id || Date.now();
    const createdDate = payload.createdAt || new Date().toISOString();
    const finalEdfNumber =
      payload.edfNumber && payload.edfNumber.trim()
        ? payload.edfNumber.trim()
        : `EDF-${new Date().getFullYear()}-OFF${String(Date.now()).slice(-4)}`;
    payload.edfNumber = finalEdfNumber;

    const localEdf: EDF = {
      id: newLocalId,
      edfNumber: finalEdfNumber,
      requesterName: payload.requesterName,
      category: payload.category,
      issueDate: payload.issueDate,
      requiredDate: payload.requiredDate,
      materialList: payload.materialList || '',
      quantity: payload.quantity || 1,
      unit: payload.unit || 'pcs',
      status: 'Pending',
      remarks: payload.remarks || null,
      createdBy: user?.name || 'You',
      createdAt: createdDate,
      items: (payload.items || []).map((it: any, idx: number) => ({
        id: idx + 1,
        edfId: newLocalId,
        itemDescription: it.itemDescription,
        quantity: it.quantity || 1,
        unit: it.unit || 'pcs',
        status: 'Pending',
      })),
      totalItemsCount: payload.items?.length || 1,
      receivedItemsCount: 0,
      isOverdue: false,
    };

    if (!isNetworkOnline) {
      // Store in IndexedDB and enqueue sync
      await upsertLocalEDF(localEdf);
      await enqueueSyncAction('create', payload);
      setEdfs((prev) => [localEdf, ...prev]);
      setStats((prev) => computeStatsFromEDFs([localEdf, ...edfs]));
      await refreshSyncCount();
      setIsCreateModalOpen(false);
      setActiveTab('edfs');
      showToast('Saved offline! Will sync automatically when connected.', 'info');
      return true;
    }

    try {
      const res = await fetch('/api/edfs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Fallback to offline queue if server is down
        await upsertLocalEDF(localEdf);
        await enqueueSyncAction('create', payload);
        setEdfs((prev) => [localEdf, ...prev]);
        setStats((prev) => computeStatsFromEDFs([localEdf, ...edfs]));
        await refreshSyncCount();
        setIsCreateModalOpen(false);
        setActiveTab('edfs');
        showToast('Saved to offline storage. Queued for sync.', 'info');
        return true;
      }

      await refreshAllData();
      setIsCreateModalOpen(false);
      setActiveTab('edfs');
      showToast('Demand form created successfully!', 'success');
      return true;
    } catch (err: any) {
      // Network failed mid-request: save offline safely
      await upsertLocalEDF(localEdf);
      await enqueueSyncAction('create', payload);
      setEdfs((prev) => [localEdf, ...prev]);
      setStats((prev) => computeStatsFromEDFs([localEdf, ...edfs]));
      await refreshSyncCount();
      setIsCreateModalOpen(false);
      setActiveTab('edfs');
      showToast('Saved offline! Queued for auto-sync.', 'info');
      return true;
    }
  };

  // Update existing EDF (Works online and offline)
  const handleUpdateEDF = async (payload: any): Promise<boolean> => {
    if (!editingEdf) return false;
    const isNetworkOnline = isOnline && typeof navigator !== 'undefined' && navigator.onLine;

    const updatedLocalEdf: EDF = {
      ...editingEdf,
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    if (!isNetworkOnline) {
      await upsertLocalEDF(updatedLocalEdf);
      await enqueueSyncAction('update', { id: editingEdf.id, data: payload });
      setEdfs((prev) => prev.map((e) => (e.id === editingEdf.id ? updatedLocalEdf : e)));
      setStats((prev) => computeStatsFromEDFs(edfs.map((e) => (e.id === editingEdf.id ? updatedLocalEdf : e))));
      await refreshSyncCount();
      setEditingEdf(null);
      showToast('Update saved offline! Will auto-sync when online.', 'info');
      return true;
    }

    try {
      const res = await fetch(`/api/edfs/${editingEdf.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Fallback to offline queue
        await upsertLocalEDF(updatedLocalEdf);
        await enqueueSyncAction('update', { id: editingEdf.id, data: payload });
        setEdfs((prev) => prev.map((e) => (e.id === editingEdf.id ? updatedLocalEdf : e)));
        await refreshSyncCount();
        setEditingEdf(null);
        showToast('Saved offline. Queued for sync.', 'info');
        return true;
      }

      await refreshAllData();
      setEditingEdf(null);
      showToast('Demand form updated successfully!', 'success');
      return true;
    } catch (err: any) {
      await upsertLocalEDF(updatedLocalEdf);
      await enqueueSyncAction('update', { id: editingEdf.id, data: payload });
      setEdfs((prev) => prev.map((e) => (e.id === editingEdf.id ? updatedLocalEdf : e)));
      await refreshSyncCount();
      setEditingEdf(null);
      showToast('Saved offline! Queued for auto-sync.', 'info');
      return true;
    }
  };

  // Delete single EDF (Works online and offline)
  const handleDeleteEDF = async (id: number) => {
    const isNetworkOnline = isOnline && typeof navigator !== 'undefined' && navigator.onLine;

    // Optimistic local deletion
    await deleteLocalEDF(id);
    const remaining = edfs.filter((e) => e.id !== id);
    setEdfs(remaining);
    setStats(computeStatsFromEDFs(remaining));

    if (!isNetworkOnline) {
      await enqueueSyncAction('delete', { id });
      await refreshSyncCount();
      showToast('Demand form deleted locally. Queued for server sync.', 'info');
      return;
    }

    try {
      const res = await fetch(`/api/edfs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        await refreshAllData();
        showToast('Demand form deleted', 'info');
      } else {
        await enqueueSyncAction('delete', { id });
        await refreshSyncCount();
        showToast('Deleted locally. Queued for server sync.', 'info');
      }
    } catch (err: any) {
      await enqueueSyncAction('delete', { id });
      await refreshSyncCount();
      showToast('Deleted locally. Queued for server sync.', 'info');
    }
  };

  // Mark status (Received / Partially Received / Pending)
  const handleMarkStatus = async (id: number, status: 'Received' | 'Partially Received' | 'Pending') => {
    // Instant optimistic update
    const updatedList = edfs.map((e) =>
      e.id === id
        ? {
            ...e,
            status,
            isOverdue: status === 'Received' ? false : e.isOverdue,
          }
        : e
    );
    setEdfs(updatedList);
    setStats(computeStatsFromEDFs(updatedList));

    const targetEdf = updatedList.find((e) => e.id === id);
    if (targetEdf) await upsertLocalEDF(targetEdf);

    const isNetworkOnline = isOnline && typeof navigator !== 'undefined' && navigator.onLine;
    if (!isNetworkOnline) {
      await enqueueSyncAction('mark-status', { id, status });
      await refreshSyncCount();
      showToast(`Status updated to ${status} (Offline). Queued for sync.`, 'info');
      return;
    }

    try {
      const res = await fetch(`/api/edfs/${id}/mark-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        await refreshAllData();
        showToast(`Status marked as ${status}`, 'success');
      } else {
        await enqueueSyncAction('mark-status', { id, status });
        await refreshSyncCount();
        showToast(`Status saved locally. Queued for sync.`, 'info');
      }
    } catch (err: any) {
      await enqueueSyncAction('mark-status', { id, status });
      await refreshSyncCount();
      showToast(`Status saved locally. Queued for sync.`, 'info');
    }
  };

  // Mark selected items as Received (Partial or Full receiving)
  const handleReceiveItems = async (edfId: number, itemIds: number[]) => {
    // Optimistic local update
    const target = edfs.find((e) => e.id === edfId);
    if (target) {
      const updatedItems = (target.items || []).map((it) =>
        itemIds.includes(it.id!)
          ? {
              ...it,
              status: 'Received' as const,
              receivedAt: new Date().toISOString(),
              receivedBy: user?.name || 'You',
            }
          : it
      );
      const totalCount = target.totalItemsCount || updatedItems.length;
      const recCount = updatedItems.filter((i) => i.status === 'Received').length;
      const newStatus = recCount >= totalCount ? ('Received' as const) : ('Partially Received' as const);
      const updatedEdf: EDF = {
        ...target,
        items: updatedItems,
        receivedItemsCount: recCount,
        status: newStatus,
        isOverdue: newStatus === 'Received' ? false : target.isOverdue,
      };

      await upsertLocalEDF(updatedEdf);
      const nextList = edfs.map((e) => (e.id === edfId ? updatedEdf : e));
      setEdfs(nextList);
      setStats(computeStatsFromEDFs(nextList));
      if (viewingEdf && viewingEdf.id === edfId) setViewingEdf(updatedEdf);
    }

    const isNetworkOnline = isOnline && typeof navigator !== 'undefined' && navigator.onLine;
    if (!isNetworkOnline) {
      await enqueueSyncAction('receive-items', { edfId, itemIds });
      await refreshSyncCount();
      showToast('Items marked as received (Offline). Queued for sync.', 'info');
      return;
    }

    try {
      const res = await fetch(`/api/edfs/${edfId}/receive-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        await enqueueSyncAction('receive-items', { edfId, itemIds });
        await refreshSyncCount();
        showToast('Saved offline. Queued for sync.', 'info');
        return;
      }

      await refreshAllData();
      if (viewingEdf && viewingEdf.id === edfId && data.edf) {
        setViewingEdf(data.edf);
      }
      showToast(data.message || 'Selected items marked as received', 'success');
    } catch (err: any) {
      await enqueueSyncAction('receive-items', { edfId, itemIds });
      await refreshSyncCount();
      showToast('Saved offline. Queued for sync.', 'info');
    }
  };

  // Undo receiving for an individual item
  const handleUndoItemReceived = async (edfId: number, itemId: number) => {
    const target = edfs.find((e) => e.id === edfId);
    if (target) {
      const updatedItems = (target.items || []).map((it) =>
        it.id === itemId
          ? {
              ...it,
              status: 'Pending' as const,
              receivedAt: undefined,
              receivedBy: undefined,
            }
          : it
      );
      const totalCount = target.totalItemsCount || updatedItems.length;
      const recCount = updatedItems.filter((i) => i.status === 'Received').length;
      const newStatus = recCount === 0 ? ('Pending' as const) : ('Partially Received' as const);
      const updatedEdf: EDF = {
        ...target,
        items: updatedItems,
        receivedItemsCount: recCount,
        status: newStatus,
      };

      await upsertLocalEDF(updatedEdf);
      const nextList = edfs.map((e) => (e.id === edfId ? updatedEdf : e));
      setEdfs(nextList);
      setStats(computeStatsFromEDFs(nextList));
      if (viewingEdf && viewingEdf.id === edfId) setViewingEdf(updatedEdf);
    }

    const isNetworkOnline = isOnline && typeof navigator !== 'undefined' && navigator.onLine;
    if (!isNetworkOnline) {
      await enqueueSyncAction('undo-item-received', { edfId, itemId });
      await refreshSyncCount();
      showToast('Reverted locally. Queued for server sync.', 'info');
      return;
    }

    try {
      const res = await fetch(`/api/edfs/${edfId}/undo-item-received`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId }),
      });

      const data = await res.json();
      if (!res.ok) {
        await enqueueSyncAction('undo-item-received', { edfId, itemId });
        await refreshSyncCount();
        showToast('Reverted locally. Queued for server sync.', 'info');
        return;
      }

      await refreshAllData();
      if (viewingEdf && viewingEdf.id === edfId && data.edf) {
        setViewingEdf(data.edf);
      }
      showToast(data.message || 'Item status reverted to pending', 'info');
    } catch (err: any) {
      await enqueueSyncAction('undo-item-received', { edfId, itemId });
      await refreshSyncCount();
      showToast('Reverted locally. Queued for server sync.', 'info');
    }
  };

  // Bulk actions
  const handleBulkAction = async (
    ids: number[],
    action: 'mark-received' | 'mark-completed' | 'delete'
  ) => {
    const isNetworkOnline = isOnline && typeof navigator !== 'undefined' && navigator.onLine;
    const apiAction = action === 'mark-completed' ? 'mark-received' : action;

    if (apiAction === 'delete') {
      for (const id of ids) {
        await deleteLocalEDF(id);
      }
      const nextList = edfs.filter((e) => !ids.includes(e.id));
      setEdfs(nextList);
      setStats(computeStatsFromEDFs(nextList));
    } else {
      const nextList = edfs.map((e) =>
        ids.includes(e.id) ? { ...e, status: 'Received' as const, isOverdue: false } : e
      );
      setEdfs(nextList);
      setStats(computeStatsFromEDFs(nextList));
      for (const item of nextList.filter((e) => ids.includes(e.id))) {
        await upsertLocalEDF(item);
      }
    }

    if (!isNetworkOnline) {
      await enqueueSyncAction('bulk-action', { ids, action: apiAction });
      await refreshSyncCount();
      showToast(`Bulk ${action} saved locally. Queued for sync.`, 'info');
      return;
    }

    try {
      const res = await fetch('/api/edfs/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids, action: apiAction }),
      });

      if (res.ok) {
        await refreshAllData();
        showToast(`Bulk action executed successfully`, 'success');
      } else {
        await enqueueSyncAction('bulk-action', { ids, action: apiAction });
        await refreshSyncCount();
        showToast('Saved offline. Queued for sync.', 'info');
      }
    } catch (err: any) {
      await enqueueSyncAction('bulk-action', { ids, action: apiAction });
      await refreshSyncCount();
      showToast('Saved offline. Queued for sync.', 'info');
    }
  };

  // CSV Export utility
  const handleExportCSV = (listToExport: EDF[] = edfs) => {
    if (listToExport.length === 0) {
      showToast('No records available to export.', 'info');
      return;
    }

    const headers = [
      'EDF Number',
      'Requester Name',
      'Category',
      'Issue Date',
      'Required Date',
      'Status',
      'Receiving Progress',
      'Material Summary',
      'Quantity',
      'Unit',
      'Remarks',
    ];

    const rows = listToExport.map((e) => {
      const rawItems = e.items || [];
      const totalCount = e.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
      const receivedCount = e.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;
      const receivingProgress =
        e.status === 'Received' || receivedCount === totalCount
          ? `${totalCount}/${totalCount} Received`
          : receivedCount > 0
          ? `Partial: ${receivedCount}/${totalCount} Received`
          : `0/${totalCount} Received`;

      return [
        `"${e.edfNumber}"`,
        `"${(e.requesterName || '').replace(/"/g, '""')}"`,
        `"${e.category}"`,
        `"${new Date(e.issueDate).toLocaleDateString()}"`,
        `"${new Date(e.requiredDate).toLocaleString()}"`,
        `"${e.isOverdue ? 'Overdue' : e.status}"`,
        `"${receivingProgress}"`,
        `"${(e.materialList || '').replace(/"/g, '""')}"`,
        e.quantity,
        `"${e.unit}"`,
        `"${(e.remarks || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `EDF_Export_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-xs font-bold text-slate-500 tracking-wider">
            Loading EDF Management System...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Navbar */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
        overdueCount={stats.overdue}
        onNavigateToOverdue={() => setActiveTab('overdue')}
        onNavigateToAuditLog={() => setActiveTab('audit_log')}
        edfs={edfs}
        onSelectEdf={(edf) => setViewingEdf(edf)}
        pendingSyncCount={pendingSyncCount}
        isSyncing={isSyncing}
        onSyncNow={processSyncQueue}
      />

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === 'create') {
              setIsCreateModalOpen(true);
            } else if (tab === 'settings') {
              setIsSettingsOpen(true);
            } else {
              setActiveTab(tab);
            }
          }}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          overdueCount={stats.overdue}
        />

        {/* Main Content View */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              edfs={edfs}
              onFilterNavigate={handleFilterNavigate}
              onOpenCreate={() => setIsCreateModalOpen(true)}
              onOpenImport={() => setActiveTab('import')}
              onExportCSV={() => handleExportCSV(edfs)}
              onRefresh={() => refreshAllData(true)}
              isRefreshing={isManualRefreshing}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'board' && (
            <KanbanBoard
              edfs={edfs}
              categories={categories}
              onViewEdf={(item) => setViewingEdf(item)}
              onEditEdf={(item) => setEditingEdf(item)}
              onOpenCreate={() => setIsCreateModalOpen(true)}
              onMarkStatus={handleMarkStatus}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'edfs' && (
            <EDFList
              edfs={edfs}
              categories={categories}
              isLoading={isLoading}
              onRefresh={() => refreshAllData(true)}
              onViewDetails={(item) => setViewingEdf(item)}
              onEdit={(item) => setEditingEdf(item)}
              onDelete={handleDeleteEDF}
              onMarkStatus={handleMarkStatus}
              onReceiveItems={handleReceiveItems}
              onUndoItemReceived={handleUndoItemReceived}
              onBulkAction={handleBulkAction}
              onOpenCreate={() => setIsCreateModalOpen(true)}
              onExportCSV={handleExportCSV}
              isAdmin={isAdmin}
              initialCategory={filterCategory}
              initialStatus={filterStatus}
              initialOverdueOnly={filterOverdueOnly}
            />
          )}

          {activeTab === 'overdue' && (
            <OverdueSection
              edfs={edfs}
              onBackToDashboard={() => setActiveTab('dashboard')}
              onViewDetails={(item) => setViewingEdf(item)}
              onEdit={(item) => setEditingEdf(item)}
              onMarkStatus={handleMarkStatus}
              isAdmin={isAdmin}
            />
          )}

          {activeTab === 'import' && (
            <ExcelImport
              categories={categories}
              onSaveEDF={handleSaveNewEDF}
              onCancel={() => setActiveTab('dashboard')}
              existingEdfs={edfs}
              onImportSuccess={() => {
                refreshAllData(true);
                setActiveTab('edfs');
              }}
            />
          )}

          {activeTab === 'users' && isAdmin && (
            <UserManager
              currentUserId={user.id}
              onCurrentUserUpdated={(updatedUser) => {
                updateUser({
                  ...user,
                  name: updatedUser.name,
                  role: updatedUser.role,
                });
              }}
            />
          )}

          {activeTab === 'reports' && (
            <Reports
              edfs={edfs}
              categories={categories}
              onExportCSV={handleExportCSV}
            />
          )}

          {activeTab === 'audit_log' && (
            <AuditLog
              onSelectEdf={(item) => setViewingEdf(item)}
              edfs={edfs}
            />
          )}
        </main>
      </div>

      {/* CREATE OR EDIT MODAL */}
      {(isCreateModalOpen || Boolean(editingEdf)) && (
        <CreateEditEDFModal
          isOpen={isCreateModalOpen || Boolean(editingEdf)}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingEdf(null);
          }}
          onSave={editingEdf ? handleUpdateEDF : handleSaveNewEDF}
          categories={categories}
          editingEdf={editingEdf}
        />
      )}

      {/* VIEW DETAILS MODAL */}
      {viewingEdf && (
        <EDFDetailsModal
          edf={viewingEdf}
          onClose={() => setViewingEdf(null)}
          onEdit={(item) => setEditingEdf(item)}
          onMarkStatus={handleMarkStatus}
          onReceiveItems={handleReceiveItems}
          onUndoItemReceived={handleUndoItemReceived}
          isAdmin={isAdmin}
        />
      )}

      {/* SETTINGS & CATEGORIES MODAL */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          categories={categories}
          onRefreshCategories={fetchCategories}
        />
      )}

      {/* Prominent Floating Online/Offline Indicator Banner */}
      <OfflineIndicator pendingSyncCount={pendingSyncCount} />

      {/* Floating In-App Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold border backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-red-50/95 dark:bg-red-950/95 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800'
                : toast.type === 'success'
                ? 'bg-emerald-50/95 dark:bg-emerald-950/95 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-900/95 text-white dark:bg-white/95 dark:text-slate-900 border-slate-700'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-auto opacity-70 hover:opacity-100 p-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
