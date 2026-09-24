/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { EdfList } from './pages/EdfList.tsx';
import { CreateEdf } from './pages/CreateEdf.tsx';
import { ImportEdf } from './pages/ImportEdf.tsx';
import { OverduePage } from './pages/OverduePage.tsx';
import { CategoriesPage } from './pages/CategoriesPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { EdfDetailModal } from './pages/EdfDetailModal.tsx';
import { OverdueDetailsModal } from './components/OverdueDetailsModal.tsx';
import { EDF, Category, DashboardStats, EDFStatus, ActivityItem } from './types/index.ts';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

function MainAppContent() {
  const { getIdToken } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [edfs, setEdfs] = useState<EDF[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [selectedEdf, setSelectedEdf] = useState<EDF | null>(null);
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Filter state for records page
  const [recordsCategoryFilter, setRecordsCategoryFilter] = useState('All');
  const [recordsStatusFilter, setRecordsStatusFilter] = useState('All');

  const addToast = (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch all core data with retry resilience
  const fetchData = useCallback(async (quiet = false, retryCount = 0) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [edfsRes, catsRes, statsRes, actRes] = await Promise.all([
        fetch('/api/edfs', { headers }),
        fetch('/api/categories', { headers }),
        fetch('/api/stats', { headers }),
        fetch('/api/activities', { headers }),
      ]);

      if (edfsRes.ok) {
        const edfsData = await edfsRes.json();
        setEdfs(edfsData);
      }

      if (catsRes.ok) {
        const catsData = await catsRes.json();
        setCategories(catsData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities(actData);
      }
    } catch (err) {
      if (retryCount < 3) {
        const delay = (retryCount + 1) * 700;
        setTimeout(() => {
          fetchData(quiet, retryCount + 1);
        }, delay);
        return;
      }
      console.warn('Temporary connection issue fetching EDF system data (will auto-refresh):', err);
    } finally {
      if (!quiet) setIsRefreshing(false);
    }
  }, [getIdToken]);

  // Initial load
  useEffect(() => {
    fetchData();

    // Auto-refresh stats and overdue synchronization every 30 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Overdue and Due Soon list calculations
  const overdueEdfs = useMemo(() => {
    const now = new Date().getTime();
    return edfs.filter((e) => {
      if (e.status === 'Completed' || e.status === 'Received') return false;
      const target = new Date(e.requiredDate).getTime();
      return target < now || e.status === 'Overdue';
    });
  }, [edfs]);

  const dueSoonEdfs = useMemo(() => {
    const now = new Date().getTime();
    const threshold48h = now + 48 * 3600 * 1000;
    return edfs.filter((e) => {
      if (e.status === 'Completed' || e.status === 'Received') return false;
      const target = new Date(e.requiredDate).getTime();
      return target >= now && target <= threshold48h;
    });
  }, [edfs]);

  // Create EDF Handler
  const handleCreateEdf = async (formData: any) => {
    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/edfs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to create EDF');
      const created = await res.json();

      addToast('success', 'EDF Requisition Created', `${created.edfNumber} was saved successfully.`);
      await fetchData();
      setCurrentTab('records');
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to create EDF', err.message || 'Please check fields and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Status Handler (e.g. Mark as Received)
  const handleUpdateStatus = async (id: number, newStatus: EDFStatus) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/edfs/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      const updated = await res.json();

      addToast(
        'success',
        `Requisition ${newStatus}`,
        `${updated.edfNumber} status updated to "${newStatus}". Timer stopped.`
      );

      // Update selectedEdf if open in modal
      if (selectedEdf && selectedEdf.id === id) {
        setSelectedEdf(updated);
      }

      await fetchData(true);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Status update failed', err.message);
    }
  };

  // Update EDF details
  const handleUpdateEdf = async (id: number, updates: Partial<EDF>) => {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/edfs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Failed to update EDF');
      const updated = await res.json();

      addToast('success', 'EDF Updated', `${updated.edfNumber} updated successfully.`);
      if (selectedEdf && selectedEdf.id === id) {
        setSelectedEdf(updated);
      }
      await fetchData(true);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Update failed', err.message);
    }
  };

  // Delete EDF Handler
  const handleDeleteEdf = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this EDF material request?')) {
      return;
    }

    try {
      const token = await getIdToken();
      const res = await fetch(`/api/edfs/${id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error('Failed to delete EDF');

      addToast('info', 'Requisition Deleted', 'The EDF record has been removed.');
      if (selectedEdf && selectedEdf.id === id) {
        setSelectedEdf(null);
      }
      await fetchData(true);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Delete failed', err.message);
    }
  };

  // Bulk Status Update Handler (e.g. Mark as Received or Completed in bulk)
  const handleBulkUpdateStatus = async (ids: number[], newStatus: EDFStatus) => {
    if (!ids || ids.length === 0) return;
    try {
      const token = await getIdToken();
      const res = await fetch('/api/edfs/bulk/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids, status: newStatus }),
      });

      if (!res.ok) {
        // Fallback to parallel individual updates if bulk endpoint encounters any issue
        await Promise.all(
          ids.map((id) =>
            fetch(`/api/edfs/${id}/status`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ status: newStatus }),
            })
          )
        );
      }

      addToast(
        'success',
        `Bulk Status: ${newStatus}`,
        `Successfully updated ${ids.length} EDF ${ids.length === 1 ? 'requisition' : 'requisitions'} to "${newStatus}".`
      );
      await fetchData(true);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Bulk status update failed', err.message);
    }
  };

  // Bulk Delete Handler
  const handleBulkDelete = async (ids: number[]) => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete these ${ids.length} EDF requisitions?`)) {
      return;
    }
    try {
      const token = await getIdToken();
      const res = await fetch('/api/edfs/bulk/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        await Promise.all(
          ids.map((id) =>
            fetch(`/api/edfs/${id}`, {
              method: 'DELETE',
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            })
          )
        );
      }

      addToast('info', 'Bulk Requisitions Deleted', `${ids.length} records removed successfully.`);
      if (selectedEdf && ids.includes(selectedEdf.id)) {
        setSelectedEdf(null);
      }
      await fetchData(true);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Bulk delete failed', err.message);
    }
  };

  // Add Category Handler
  const handleAddCategory = async (categoryName: string, description: string) => {
    try {
      const token = await getIdToken();
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ categoryName, description }),
      });

      if (!res.ok) throw new Error('Failed to add category');
      addToast('success', 'Category Created', `Category "${categoryName}" added.`);
      await fetchData(true);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to add category', err.message);
    }
  };

  // Navigation callbacks
  const handleNavigateToCategory = (catName: string) => {
    setRecordsCategoryFilter(catName);
    setRecordsStatusFilter('All');
    setCurrentTab('records');
  };

  const categoryNames = categories.map((c) => c.categoryName);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        overdueCount={overdueEdfs.length}
        dueSoonCount={dueSoonEdfs.length}
        isOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Navbar */}
        <Navbar
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          onOpenCreate={() => setCurrentTab('create')}
          onOpenImport={() => setCurrentTab('import')}
          onRefresh={() => fetchData()}
          isRefreshing={isRefreshing}
          overdueEdfs={overdueEdfs}
          dueSoonEdfs={dueSoonEdfs}
          onSelectEdf={(e) => setSelectedEdf(e)}
          onOpenOverdueDetails={() => setIsOverdueModalOpen(true)}
        />

        {/* Page Content Router */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              recentEdfs={edfs}
              overdueEdfs={overdueEdfs}
              activities={activities}
              onSelectEdf={(e) => setSelectedEdf(e)}
              onNavigateToCategory={handleNavigateToCategory}
              onNavigateToOverdue={() => setCurrentTab('overdue')}
              onNavigateToRecords={() => {
                setRecordsCategoryFilter('All');
                setRecordsStatusFilter('All');
                setCurrentTab('records');
              }}
              onOpenCreate={() => setCurrentTab('create')}
              onOpenImport={() => setCurrentTab('import')}
              onMarkReceived={(id) => handleUpdateStatus(id, 'Received')}
              onOpenOverdueDetails={() => setIsOverdueModalOpen(true)}
              onRefreshActivities={() => fetchData(true)}
              isRefreshingActivities={isRefreshing}
            />
          )}

          {currentTab === 'records' && (
            <EdfList
              edfs={edfs}
              categories={categoryNames}
              initialCategory={recordsCategoryFilter}
              initialStatus={recordsStatusFilter}
              onSelectEdf={(e) => setSelectedEdf(e)}
              onOpenCreate={() => setCurrentTab('create')}
              onOpenImport={() => setCurrentTab('import')}
              onMarkReceived={(id) => handleUpdateStatus(id, 'Received')}
              onMarkCompleted={(id) => handleUpdateStatus(id, 'Completed')}
              onDeleteEdf={handleDeleteEdf}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkDelete={handleBulkDelete}
            />
          )}

          {currentTab === 'create' && (
            <CreateEdf
              categories={categories}
              onCancel={() => setCurrentTab('records')}
              onSubmit={handleCreateEdf}
              isSubmitting={isSubmitting}
            />
          )}

          {currentTab === 'import' && (
            <ImportEdf
              categories={categories}
              onConfirmSave={handleCreateEdf}
              onCancel={() => setCurrentTab('records')}
              isSaving={isSubmitting}
            />
          )}

          {currentTab === 'overdue' && (
            <OverduePage
              overdueEdfs={overdueEdfs}
              categories={categoryNames}
              onSelectEdf={(e) => setSelectedEdf(e)}
              onMarkReceived={(id) => handleUpdateStatus(id, 'Received')}
              onMarkCompleted={(id) => handleUpdateStatus(id, 'Completed')}
            />
          )}

          {currentTab === 'categories' && (
            <CategoriesPage
              categories={categories}
              edfs={edfs}
              onAddCategory={handleAddCategory}
              onSelectCategoryFilter={handleNavigateToCategory}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsPage stats={stats} edfs={edfs} />
          )}

          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Detail / Edit Modal */}
      {selectedEdf && (
        <EdfDetailModal
          edf={selectedEdf}
          onClose={() => setSelectedEdf(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateEdf={handleUpdateEdf}
          onDeleteEdf={handleDeleteEdf}
        />
      )}

      {/* Comprehensive Overdue Requisitions Details Modal (Triggered by Overdue Detail Bar) */}
      <OverdueDetailsModal
        isOpen={isOverdueModalOpen}
        onClose={() => setIsOverdueModalOpen(false)}
        overdueEdfs={overdueEdfs}
        onSelectEdf={(e) => {
          setIsOverdueModalOpen(false);
          setSelectedEdf(e);
        }}
        onMarkReceived={(id) => handleUpdateStatus(id, 'Received')}
      />

      {/* Floating Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-xs flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5 ${
              t.type === 'success'
                ? 'bg-emerald-900/95 text-emerald-100 border-emerald-700'
                : t.type === 'error'
                ? 'bg-rose-900/95 text-rose-100 border-rose-700'
                : t.type === 'warning'
                ? 'bg-amber-900/95 text-amber-100 border-amber-700'
                : 'bg-slate-900/95 text-slate-100 border-slate-700'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}

            <div className="flex-1 min-w-0">
              <span className="font-bold block">{t.title}</span>
              {t.message && <span className="opacity-90 mt-0.5 block">{t.message}</span>}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-white/60 hover:text-white p-0.5 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
