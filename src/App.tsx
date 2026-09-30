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
  received: 0,
  completed: 0,
  overdue: 0,
  recentActivity: [],
  categoryDistribution: [],
  statusDistribution: [],
};

const MainLayout: React.FC = () => {
  const { user, token, isAdmin, isLoading: authLoading } = useAuth();

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

  // Fetch all EDFs
  const fetchEDFs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/edfs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEdfs(data);
      }
    } catch (err) {
      console.error('Failed to load EDFs:', err);
    }
  }, [token]);

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [token]);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, [token]);

  // Refresh all application data
  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchEDFs(), fetchStats(), fetchCategories()]);
    setIsLoading(false);
  }, [fetchEDFs, fetchStats, fetchCategories]);

  useEffect(() => {
    if (token) {
      refreshAllData();
    }
  }, [token, refreshAllData]);

  // Periodic subtle background poll to update overdue calculations every 15s
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchEDFs();
      fetchStats();
    }, 15000);
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
        alert(data.error || 'Failed to create EDF');
        return false;
      }

      await refreshAllData();
      setIsCreateModalOpen(false);
      setActiveTab('edfs');
      return true;
    } catch (err: any) {
      alert(err.message || 'Error creating EDF');
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
        alert(data.error || 'Failed to update EDF');
        return false;
      }

      await refreshAllData();
      setEditingEdf(null);
      return true;
    } catch (err: any) {
      alert(err.message || 'Error updating EDF');
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
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete EDF');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting EDF');
    }
  };

  // Mark status (Received / Completed)
  const handleMarkStatus = async (id: number, status: 'Received' | 'Completed' | 'Pending') => {
    // Instant optimistic update: stop timer and clear overdue immediately
    setEdfs((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status,
              isOverdue: status === 'Received' || status === 'Completed' ? false : e.isOverdue,
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
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
        await refreshAllData();
      }
    } catch (err: any) {
      alert(err.message || 'Error updating status');
      await refreshAllData();
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
      } else {
        const data = await res.json();
        alert(data.error || 'Bulk action failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error performing bulk action');
    }
  };

  // CSV Export utility
  const handleExportCSV = (listToExport: EDF[] = edfs) => {
    if (listToExport.length === 0) {
      alert('No records available to export.');
      return;
    }

    const headers = [
      'EDF Number',
      'Requester Name',
      'Category',
      'Issue Date',
      'Required Date',
      'Status',
      'Material Summary',
      'Quantity',
      'Unit',
      'Remarks',
    ];

    const rows = listToExport.map((e) => [
      `"${e.edfNumber}"`,
      `"${e.requesterName.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      `"${new Date(e.issueDate).toLocaleDateString()}"`,
      `"${new Date(e.requiredDate).toLocaleString()}"`,
      `"${e.isOverdue ? 'Overdue' : e.status}"`,
      `"${e.materialList.replace(/"/g, '""')}"`,
      e.quantity,
      `"${e.unit}"`,
      `"${(e.remarks || '').replace(/"/g, '""')}"`,
    ]);

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
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
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
              onRefresh={refreshAllData}
              isRefreshing={isLoading}
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
              onRefresh={refreshAllData}
              onViewDetails={(item) => setViewingEdf(item)}
              onEdit={(item) => setEditingEdf(item)}
              onDelete={handleDeleteEDF}
              onMarkStatus={handleMarkStatus}
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
            />
          )}

          {activeTab === 'users' && isAdmin && (
            <UserManager currentUserId={user.id} />
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
