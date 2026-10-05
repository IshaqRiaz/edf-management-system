import React, { useState, useEffect, useCallback } from 'react';
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

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // App Data State
  const [edfs, setEdfs] = useState<EDF[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [isLoading, setIsLoading] = useState(true);

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

  // Fetch all EDFs
  const fetchEDFs = useCallback(async () => {
    const data = await fetchWithRetry('/api/edfs');
    if (Array.isArray(data)) {
      setEdfs(data);
    }
  }, [fetchWithRetry]);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    const data = await fetchWithRetry('/api/dashboard/stats');
    if (data && typeof data === 'object') {
      setStats(data);
    }
  }, [fetchWithRetry]);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    const data = await fetchWithRetry('/api/categories');
    if (Array.isArray(data)) {
      setCategories(data);
    }
  }, [fetchWithRetry]);

  // Refresh all application data
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const refreshAllData = useCallback(async (isManual = false) => {
    if (isManual) setIsManualRefreshing(true);
    else setIsLoading(true);
    await Promise.all([fetchEDFs(), fetchStats(), fetchCategories()]);
    if (isManual) setIsManualRefreshing(false);
    else setIsLoading(false);
  }, [fetchEDFs, fetchStats, fetchCategories]);

  useEffect(() => {
    if (token) {
      refreshAllData(false);
    }
  }, [token, refreshAllData]);

  // Periodic subtle background poll to update overdue calculations, statuses, timers, and stats every 5 seconds
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchEDFs();
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [token, fetchEDFs, fetchStats]);

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

  // Create EDF
  const handleSaveNewEDF = async (payload: any): Promise<boolean> => {
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
        const data = await res.json();
        showToast(data.error || 'Failed to create EDF', 'error');
        return false;
      }

      await refreshAllData();
      setIsCreateModalOpen(false);
      setActiveTab('edfs');
      showToast('Demand form created successfully!', 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Error creating EDF', 'error');
      return false;
    }
  };

  // Update existing EDF
  const handleUpdateEDF = async (payload: any): Promise<boolean> => {
    if (!editingEdf) return false;
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
        const data = await res.json();
        showToast(data.error || 'Failed to update EDF', 'error');
        return false;
      }

      await refreshAllData();
      setEditingEdf(null);
      showToast('Demand form updated successfully!', 'success');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Error updating EDF', 'error');
      return false;
    }
  };

  // Delete single EDF
  const handleDeleteEDF = async (id: number) => {
    try {
      const res = await fetch(`/api/edfs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        await refreshAllData();
        showToast('Demand form deleted', 'info');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete EDF', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting EDF', 'error');
    }
  };

  // Mark status (Received / Partially Received / Pending)
  const handleMarkStatus = async (id: number, status: 'Received' | 'Partially Received' | 'Pending') => {
    // Instant optimistic update: stop timer and clear overdue immediately
    setEdfs((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status,
              isOverdue: status === 'Received' ? false : e.isOverdue,
            }
          : e
      )
    );

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
        const data = await res.json();
        showToast(data.error || 'Failed to update status', 'error');
        await refreshAllData();
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating status', 'error');
      await refreshAllData();
    }
  };

  // Mark selected items as Received (Partial or Full receiving)
  const handleReceiveItems = async (edfId: number, itemIds: number[]) => {
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
        showToast(data.error || 'Failed to mark items as received', 'error');
        return;
      }

      await refreshAllData();
      if (viewingEdf && viewingEdf.id === edfId && data.edf) {
        setViewingEdf(data.edf);
      }
      showToast(data.message || 'Selected items marked as received', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error receiving items', 'error');
    }
  };

  // Undo receiving for an individual item
  const handleUndoItemReceived = async (edfId: number, itemId: number) => {
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
        showToast(data.error || 'Failed to undo item receiving', 'error');
        return;
      }

      await refreshAllData();
      if (viewingEdf && viewingEdf.id === edfId && data.edf) {
        setViewingEdf(data.edf);
      }
      showToast(data.message || 'Item status reverted to pending', 'info');
    } catch (err: any) {
      showToast(err.message || 'Error reverting item status', 'error');
    }
  };

  // Bulk actions
  const handleBulkAction = async (
    ids: number[],
    action: 'mark-received' | 'mark-completed' | 'delete'
  ) => {
    try {
      const res = await fetch('/api/edfs/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids, action }),
      });

      if (res.ok) {
        await refreshAllData();
        showToast(`Bulk action (${action}) completed successfully`, 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Bulk action failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error performing bulk action', 'error');
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
