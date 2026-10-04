import React, { useState, useEffect, useMemo } from 'react';
import { EDF, Category, EDFStatusHistory } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { generateReportPdf, generateReceiptAuditPdf } from '../utils/reportPdf.ts';
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  Printer,
  PieChart,
  TrendingUp,
  FileDown,
  Filter,
  PackageCheck,
  Clock,
  AlertOctagon,
  Sparkles,
  FileText,
  History,
  Shield,
  User,
  Search,
  RefreshCw,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';

interface ReportsProps {
  edfs: EDF[];
  categories: Category[];
  onExportCSV: (filtered: EDF[]) => void;
}

export const Reports: React.FC<ReportsProps> = ({
  edfs,
  categories,
  onExportCSV,
}) => {
  const { user } = useAuth();
  const [activeReportTab, setActiveReportTab] = useState<'analytics' | 'audit_logs'>('analytics');

  // Filter states for general analytics
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Status & Delivery Audit Logs State
  const [statusLogs, setStatusLogs] = useState<EDFStatusHistory[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logActionFilter, setLogActionFilter] = useState<'all' | 'received' | 'completed' | 'pending'>('all');
  const [logRoleFilter, setLogRoleFilter] = useState<'all' | 'admin' | 'visitor'>('all');
  const [logSearch, setLogSearch] = useState('');

  // Fetch status & delivery history logs
  const fetchStatusLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const res = await fetch('/api/status-history', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('edf_auth_token')}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setStatusLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch status logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchStatusLogs();
  }, []);

  // Filtered dataset for reporting
  const filtered = useMemo(() => {
    return edfs.filter((item) => {
      if (selectedCategory !== 'All' && item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (selectedStatus !== 'All') {
        if (selectedStatus === 'Overdue') {
          const isOverdue = (item.status === 'Overdue' || item.isOverdue) && item.status !== 'Completed' && item.status !== 'Received';
          if (!isOverdue) return false;
        } else if (item.status.toLowerCase() !== selectedStatus.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }, [edfs, selectedCategory, selectedStatus]);

  const total = edfs.length || 1;
  const filteredTotal = filtered.length || 1;
  const completedCount = filtered.filter((e) => e.status === 'Completed').length;
  const overdueCount = filtered.filter((e) => (e.status === 'Overdue' || e.isOverdue) && e.status !== 'Completed' && e.status !== 'Received').length;
  const receivedCount = filtered.filter((e) => e.status === 'Received').length;
  const pendingCount = filtered.filter((e) => e.status === 'Pending').length;
  const fulfillmentRate = Math.round((completedCount / filteredTotal) * 100);

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return statusLogs.filter((log) => {
      // 1. Action filter
      if (logActionFilter !== 'all') {
        if (String(log.toStatus).toLowerCase() !== logActionFilter.toLowerCase()) {
          return false;
        }
      }
      // 2. Role filter (checks if changedBy string contains '[Admin]' or '[Visitor]')
      if (logRoleFilter !== 'all') {
        const changedByLower = String(log.changedBy || '').toLowerCase();
        if (logRoleFilter === 'admin' && !changedByLower.includes('admin')) {
          return false;
        }
        if (logRoleFilter === 'visitor' && !changedByLower.includes('visitor')) {
          return false;
        }
      }
      // 3. Search query
      if (logSearch.trim()) {
        const query = logSearch.toLowerCase().trim();
        const matchesEdf = log.edfNumber.toLowerCase().includes(query);
        const matchesActor = String(log.changedBy || '').toLowerCase().includes(query);
        const matchesNotes = String(log.notes || '').toLowerCase().includes(query);
        if (!matchesEdf && !matchesActor && !matchesNotes) {
          return false;
        }
      }
      return true;
    });
  }, [statusLogs, logActionFilter, logRoleFilter, logSearch]);

  // Handle PDF report generation
  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      generateReportPdf({
        edfs: filtered,
        categories,
        selectedCategory,
        selectedStatus,
        userName: user?.name || 'Coordinator',
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate report PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Export Receipt & Status History to CSV
  const handleExportReceiptLogsCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No audit logs available to export.');
      return;
    }

    const headers = [
      'Log ID',
      'EDF Number',
      'Action / New Status',
      'Previous Status',
      'Logged By (Actor & Role)',
      'Timestamp',
      'Notes',
    ];

    const rows = filteredLogs.map((log) => [
      log.id || '',
      `"${log.edfNumber}"`,
      `"${log.toStatus}"`,
      `"${log.fromStatus || 'None'}"`,
      `"${(log.changedBy || 'System').replace(/"/g, '""')}"`,
      `"${new Date(log.createdAt).toLocaleString().replace(/"/g, '""')}"`,
      `"${(log.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `EDF_Receipt_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Receipt & Status History to PDF
  const handleExportReceiptLogsPDF = () => {
    try {
      generateReceiptAuditPdf({
        logs: filteredLogs,
        userName: user?.name || 'Coordinator',
        filterLabel: `Action: ${logActionFilter.toUpperCase()} | Role: ${logRoleFilter.toUpperCase()}`,
      });
    } catch (err) {
      console.error('Failed to export audit PDF:', err);
      alert('Failed to generate Receipt Audit PDF.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Navigation Pills & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shadow-xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Reports & Demand Analytics
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                Audit Trail Ready
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Department fulfillment rates, real-time receipt logs, visitor/admin tracking, and formal PDF/CSV exports.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {activeReportTab === 'analytics' ? (
            <>
              {/* DOWNLOAD REPORT PDF BUTTON */}
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/25 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="Generate and download formatted PDF report of current filtered EDF records"
              >
                <FileDown className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
                <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Report PDF'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Print report layout"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>

              <button
                onClick={() => onExportCSV(filtered)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                title="Export filtered records as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </>
          ) : (
            <>
              {/* AUDIT LOG SPECIFIC ACTIONS */}
              <button
                onClick={handleExportReceiptLogsPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/25 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                title="Download Receipt & Completion Audit Log as formatted PDF"
              >
                <FileDown className="w-4 h-4" />
                <span>Download Audit PDF</span>
              </button>

              <button
                onClick={handleExportReceiptLogsCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                title="Export Receipt & Completion Logs to CSV"
              >
                <Download className="w-4 h-4" />
                <span>Export Logs CSV</span>
              </button>

              <button
                onClick={fetchStatusLogs}
                disabled={isLoadingLogs}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Refresh audit logs"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 w-fit">
        <button
          onClick={() => setActiveReportTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeReportTab === 'analytics'
              ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Demand Analytics & Reports</span>
        </button>

        <button
          onClick={() => setActiveReportTab('audit_logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeReportTab === 'audit_logs'
              ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Receipt & Completion Audit Log</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {statusLogs.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DEMAND ANALYTICS & FULFILLMENT REPORTS                             */}
      {/* ========================================================================= */}
      {activeReportTab === 'analytics' && (
        <div className="space-y-6">
          {/* Interactive Filters Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-1">
                <Filter className="w-3.5 h-3.5 text-rose-500" />
                <span>Filter Report:</span>
              </div>

              {/* Category Dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <label htmlFor="report-category" className="text-slate-500 font-semibold">Category:</label>
                <select
                  id="report-category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <label htmlFor="report-status" className="text-slate-500 font-semibold">Status:</label>
                <select
                  id="report-status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                  <option value="Completed">Completed</option>
                  <option value="Overdue">Overdue Only</option>
                </select>
              </div>

              {/* Reset Filters */}
              {(selectedCategory !== 'All' || selectedStatus !== 'All') && (
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setSelectedStatus('All');
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Filtered Count Badge */}
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Showing <span className="font-mono text-rose-600 dark:text-rose-400 font-extrabold">{filtered.length}</span> of {edfs.length} Demand Forms in current report
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black tracking-wider text-slate-400 mb-1">
                Fulfillment Rate
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {fulfillmentRate}%
                </span>
                <span className="text-xs text-slate-400 font-medium">of filtered requests</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${fulfillmentRate}%` }}
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black tracking-wider text-slate-400 mb-1">
                Completed Demands
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  {completedCount}
                </span>
                <span className="text-xs text-emerald-600 font-bold">Delivered</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Fulfilled without outstanding items</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black tracking-wider text-slate-400 mb-1">
                Active / In-Transit
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-sky-600 dark:text-sky-400">
                  {receivedCount + pendingCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">{pendingCount} Pending • {receivedCount} Received</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Currently undergoing delivery & inspection</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black tracking-wider text-rose-500 mb-1">
                Overdue Demands
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-600">
                  {overdueCount}
                </span>
                <span className="text-xs text-rose-500 font-bold">Past Deadline</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Requires prompt coordinator action</p>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 dark:text-white tracking-wider">
                Departmental Demand Breakdown
              </h3>
              <span className="text-xs text-slate-400">Filtered distribution</span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-[11px]">
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Total Demands</th>
                    <th className="py-3 px-4 text-center">Completed</th>
                    <th className="py-3 px-4 text-center">Received</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-4 text-center">Overdue</th>
                    <th className="py-3 px-4 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categories.map((cat) => {
                    const catEdfs = filtered.filter(
                      (e) => e.category.toLowerCase() === cat.name.toLowerCase()
                    );
                    const count = catEdfs.length;
                    const completed = catEdfs.filter((e) => e.status === 'Completed').length;
                    const received = catEdfs.filter((e) => e.status === 'Received').length;
                    const overdue = catEdfs.filter((e) => (e.status === 'Overdue' || e.isOverdue) && e.status !== 'Completed' && e.status !== 'Received').length;
                    const pending = catEdfs.filter((e) => e.status === 'Pending' && !e.isOverdue).length;
                    const share = filteredTotal > 0 ? Math.round((count / filteredTotal) * 100) : 0;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                          {cat.name}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold font-mono text-slate-900 dark:text-white">
                          {count}
                        </td>
                        <td className="py-2.5 px-4 text-center font-semibold text-emerald-600">
                          {completed}
                        </td>
                        <td className="py-2.5 px-4 text-center font-semibold text-sky-600">
                          {received}
                        </td>
                        <td className="py-2.5 px-4 text-center font-semibold text-amber-600">
                          {pending}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-rose-600">
                          {overdue}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                          {share}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Filtered EDF Records Preview */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-slate-900 dark:text-white tracking-wider">
                  Filtered Records in PDF Report
                </h3>
                <span className="font-mono text-xs font-bold text-slate-400">
                  ({filtered.length} entries)
                </span>
              </div>

              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export to PDF</span>
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-[11px] sticky top-0 z-10">
                    <th className="py-2.5 px-4">EDF #</th>
                    <th className="py-2.5 px-4">Requester</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Issue Date</th>
                    <th className="py-2.5 px-4">Required Date</th>
                    <th className="py-2.5 px-4">Material Summary</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                        No EDF records match the selected category and status filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => {
                      const isOverdue = (item.status === 'Overdue' || item.isOverdue) && item.status !== 'Completed' && item.status !== 'Received';
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${
                            isOverdue ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {item.edfNumber}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                            {item.requesterName}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                            {new Date(item.issueDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium font-mono text-[11px]">
                            {new Date(item.requiredDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {item.materialList} ({item.quantity} {item.unit})
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                                isOverdue
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                  : item.status === 'Completed'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : item.status === 'Received'
                                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {isOverdue ? 'Overdue' : item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECEIPT & COMPLETION AUDIT TRAIL LOGS (WHO MARKED RECEIVED/COMPLETED) */}
      {/* ========================================================================= */}
      {activeReportTab === 'audit_logs' && (
        <div className="space-y-6">
          {/* Audit Trail Filter Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Action Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-slate-500 font-semibold">Action:</label>
                <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <button
                    onClick={() => setLogActionFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logActionFilter === 'all'
                        ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-300 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setLogActionFilter('received')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logActionFilter === 'received'
                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Received Only
                  </button>
                  <button
                    onClick={() => setLogActionFilter('completed')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logActionFilter === 'completed'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Completed Only
                  </button>
                </div>
              </div>

              {/* Role Filter (Admin vs Visitor) */}
              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-slate-500 font-semibold">Actor Role:</label>
                <select
                  value={logRoleFilter}
                  onChange={(e: any) => setLogRoleFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs focus:ring-2 focus:ring-rose-500 outline-none cursor-pointer"
                >
                  <option value="all">All Roles (Admin & Visitor)</option>
                  <option value="admin">Admin Only</option>
                  <option value="visitor">Visitor / Coordinator Only</option>
                </select>
              </div>
            </div>

            {/* Search Input in Audit Trail */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search EDF # or actor..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white tracking-wider">
                  EDF Receipt & Status Audit Trail
                </h3>
                <p className="text-[11px] text-slate-400">
                  Permanent record of which Admin or Visitor marked demand forms as Received or Completed
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportReceiptLogsCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                  title="Export audit records to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleExportReceiptLogsPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-bold text-xs transition-colors cursor-pointer"
                  title="Download audit records as PDF"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-[11px]">
                    <th className="py-3 px-4 w-16 text-center">ID</th>
                    <th className="py-3 px-4">EDF Number</th>
                    <th className="py-3 px-4">Action / Event</th>
                    <th className="py-3 px-4">Logged By (Actor & Role)</th>
                    <th className="py-3 px-4 text-center">Status Transition</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-rose-500" />
                        <span className="font-semibold text-xs">Loading receipt audit records...</span>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                        No delivery or status records match your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isReceived = String(log.toStatus).toLowerCase() === 'received';
                      const isCompleted = String(log.toStatus).toLowerCase() === 'completed';
                      const isVisitor = String(log.changedBy || '').toLowerCase().includes('visitor');
                      const isAdmin = String(log.changedBy || '').toLowerCase().includes('admin');

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          {/* Log ID */}
                          <td className="py-2.5 px-4 font-mono text-center text-slate-400 font-bold">
                            #{log.id}
                          </td>

                          {/* EDF Number */}
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {log.edfNumber}
                          </td>

                          {/* Action Badge */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {isReceived && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                <PackageCheck className="w-3.5 h-3.5" />
                                <span>Marked Received</span>
                              </span>
                            )}
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Completed</span>
                              </span>
                            )}
                            {!isReceived && !isCompleted && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{log.toStatus}</span>
                              </span>
                            )}
                          </td>

                          {/* Logged By (Actor & Role) */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {log.changedBy || 'System'}
                              </span>
                              {isAdmin && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                  Admin
                                </span>
                              )}
                              {isVisitor && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                                  Visitor
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status Transition */}
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                              <span className="text-slate-400">{log.fromStatus || 'None'}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <strong className={isReceived ? 'text-sky-600' : isCompleted ? 'text-emerald-600' : 'text-slate-700'}>
                                {log.toStatus}
                              </strong>
                            </div>
                          </td>

                          {/* Timestamp */}
                          <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>

                          {/* Notes */}
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate italic">
                            {log.notes || 'Status updated'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
