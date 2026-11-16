import React, { useState, useEffect, useMemo } from 'react';
import { EDF, Category, EDFStatusHistory } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { generateReportPdf, generateReceiptAuditPdf } from '../utils/reportPdf.ts';
import { getLocalAuditLogs } from '../utils/offlineStorage.ts';
import {
  ExportFilterType,
  countUniqueEdfStats,
  filterEdfsForExport,
  getEdfMaterialRows,
  getEffectiveEdfState,
  getExportFilterLabel,
} from '../utils/exportHelpers.ts';
import {
  BarChart3,
  Download,
  Layers,
  CheckCircle2,
  Printer,
  FileDown,
  Filter,
  PackageCheck,
  Clock,
  AlertOctagon,
  History,
  Search,
  RefreshCw,
  ArrowRight,
  Hash,
  X,
  AlertCircle,
} from 'lucide-react';

interface ReportsProps {
  edfs: EDF[];
  categories: Category[];
  onExportCSV: (filtered: EDF[], filterLabel?: string) => void;
}

export const Reports: React.FC<ReportsProps> = ({
  edfs,
  categories,
  onExportCSV,
}) => {
  const { user } = useAuth();
  const [activeReportTab, setActiveReportTab] = useState<'analytics' | 'audit_logs'>('analytics');

  // Export & report filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<ExportFilterType>('Total');
  const [specificEdfNumber, setSpecificEdfNumber] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Status & Delivery Audit Logs State
  const [statusLogs, setStatusLogs] = useState<EDFStatusHistory[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logActionFilter, setLogActionFilter] = useState<'all' | 'received' | 'partially_received' | 'pending'>('all');
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
      } else {
        const cached = await getLocalAuditLogs();
        if (cached && cached.length > 0) setStatusLogs(cached);
      }
    } catch (err) {
      const cached = await getLocalAuditLogs();
      if (cached && cached.length > 0) setStatusLogs(cached);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchStatusLogs();
  }, []);

  // Deduplicated, EDF-number-counted, filtered dataset for both CSV & PDF exports
  const {
    uniqueAllEdfs,
    filteredEdfs: filtered,
    counts: uniqueCounts,
    totalMaterialItems,
  } = useMemo(() => {
    return filterEdfsForExport(edfs, {
      statusFilter: selectedStatus,
      categoryFilter: selectedCategory,
      specificEdfNumber,
    });
  }, [edfs, selectedStatus, selectedCategory, specificEdfNumber]);

  const uniqueEdfOptions = useMemo(() => {
    return uniqueAllEdfs.map((e) => e.edfNumber).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [uniqueAllEdfs]);

  const filteredStats = useMemo(() => countUniqueEdfStats(filtered), [filtered]);
  const filteredTotal = filteredStats.total || 1;
  const receivedCount = filteredStats.received;
  const partiallyReceivedCount = filteredStats.partiallyReceived;
  const overdueCount = filteredStats.overdue;
  const pendingCount = filteredStats.pending;
  const fulfillmentRate = filtered.length > 0 ? Math.round((receivedCount / filteredTotal) * 100) : 0;

  const activeFilterLabel = useMemo(() => {
    return getExportFilterLabel({
      statusFilter: selectedStatus,
      specificEdfNumber,
    });
  }, [selectedStatus, specificEdfNumber]);

  const activeFilterDisplay = useMemo(() => {
    if (selectedStatus === 'Specific') {
      return specificEdfNumber.trim()
        ? `Specific EDF Number (${specificEdfNumber.trim()})`
        : 'Specific EDF Number (All)';
    }
    switch (selectedStatus) {
      case 'Total':
        return 'Total EDF';
      case 'Pending':
        return 'Pending EDF';
      case 'Partially Received':
        return 'Partially Received EDF';
      case 'Received':
        return 'Received EDF';
      case 'Overdue':
        return 'Overdue EDF';
      default:
        return 'Total EDF';
    }
  }, [selectedStatus, specificEdfNumber]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setExportFeedback({ type, text });
    setTimeout(() => {
      setExportFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return statusLogs.filter((log) => {
      if (logActionFilter !== 'all') {
        const toLower = String(log.toStatus).toLowerCase();
        if (logActionFilter === 'received') {
          if (toLower !== 'received' && toLower !== 'completed') return false;
        } else if (logActionFilter === 'partially_received') {
          if (toLower !== 'partially received') return false;
        } else if (logActionFilter === 'pending') {
          if (toLower !== 'pending') return false;
        } else {
          return false;
        }
      }
      if (logRoleFilter !== 'all') {
        const changedByLower = String(log.changedBy || '').toLowerCase();
        if (logRoleFilter === 'admin' && !changedByLower.includes('admin')) {
          return false;
        }
        if (logRoleFilter === 'visitor' && !changedByLower.includes('visitor')) {
          return false;
        }
      }
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
    if (filtered.length === 0) {
      showFeedback('error', 'No EDF records match the selected export filter.');
      return;
    }
    try {
      setIsGeneratingPdf(true);
      generateReportPdf({
        edfs: filtered,
        categories,
        selectedCategory,
        selectedStatus: activeFilterDisplay,
        specificEdfNumber,
        filterLabel: activeFilterDisplay,
        userName: user?.name || 'Coordinator',
      });
      showFeedback(
        'success',
        `Downloaded PDF report with ${filtered.length} unique EDF${filtered.length === 1 ? '' : 's'} (${totalMaterialItems} material item${totalMaterialItems === 1 ? '' : 's'}).`
      );
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      showFeedback('error', 'Failed to generate report PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handle CSV report export
  const handleDownloadCsv = () => {
    if (filtered.length === 0) {
      showFeedback('error', 'No EDF records match the selected export filter.');
      return;
    }
    onExportCSV(filtered, activeFilterLabel);
    showFeedback(
      'success',
      `Exported CSV with ${filtered.length} unique EDF${filtered.length === 1 ? '' : 's'} (${totalMaterialItems} material item${totalMaterialItems === 1 ? '' : 's'}).`
    );
  };

  // Export Receipt & Status History to CSV
  const handleExportReceiptLogsCSV = () => {
    if (filteredLogs.length === 0) {
      showFeedback('error', 'No audit logs available to export.');
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
    URL.revokeObjectURL(url);
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
      showFeedback('error', 'Failed to generate Receipt Audit PDF.');
    }
  };

  const exportFilterTabs: {
    key: ExportFilterType;
    label: string;
    count: number;
    activeClass: string;
    badgeClass: string;
  }[] = [
    {
      key: 'Total',
      label: 'Total EDF',
      count: uniqueCounts.total,
      activeClass: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm',
      badgeClass: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
    },
    {
      key: 'Pending',
      label: 'Pending EDF',
      count: uniqueCounts.pending,
      activeClass: 'bg-amber-600 text-white shadow-sm',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      key: 'Partially Received',
      label: 'Partially Received EDF',
      count: uniqueCounts.partiallyReceived,
      activeClass: 'bg-sky-600 text-white shadow-sm',
      badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    },
    {
      key: 'Received',
      label: 'Received EDF',
      count: uniqueCounts.received,
      activeClass: 'bg-emerald-600 text-white shadow-sm',
      badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      key: 'Overdue',
      label: 'Overdue EDF',
      count: uniqueCounts.overdue,
      activeClass: 'bg-rose-600 text-white shadow-sm',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    },
    {
      key: 'Specific',
      label: 'Specific EDF Number',
      count: specificEdfNumber.trim() ? filtered.length : uniqueCounts.total,
      activeClass: 'bg-indigo-600 text-white shadow-sm',
      badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
    },
  ];

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
                Reports & Export Center
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                Unique EDF Grouping
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filter by status or specific EDF number, preview grouped material rows, and export consistent PDF & CSV reports.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {activeReportTab === 'analytics' ? (
            <>
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf || filtered.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/25 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="Generate and download formatted PDF report of filtered unique EDF records"
              >
                <FileDown className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
                <span>{isGeneratingPdf ? 'Generating PDF...' : `Download Report PDF (${filtered.length})`}</span>
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
                onClick={handleDownloadCsv}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                title="Export filtered unique EDF records as grouped CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV ({filtered.length})</span>
              </button>
            </>
          ) : (
            <>
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

      {/* Inline Feedback Notice */}
      {exportFeedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
            exportFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {exportFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{exportFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportFeedback(null)}
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
          {/* Export Filters & EDF-Number-Based Counting Bar */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100">
                <Filter className="w-4 h-4 text-rose-500" />
                <span>Export Filters (Counted by Unique EDF Number)</span>
              </div>

              {/* Pre-Export Unique EDF Count Summary */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-bold">
                  Matching Unique EDFs:{' '}
                  <span className="font-mono text-sm font-black">{filtered.length}</span>
                  <span className="text-rose-500/80 dark:text-rose-400/80 font-semibold ml-1.5">
                    of {uniqueCounts.total} unique EDF{uniqueCounts.total === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  Material Items:{' '}
                  <span className="font-mono font-black">{totalMaterialItems}</span>
                </div>
              </div>
            </div>

            {/* 6 Export Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {exportFilterTabs.map((tab) => {
                const isActive = selectedStatus === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(tab.key);
                      if (tab.key !== 'Specific' && specificEdfNumber) {
                        setSpecificEdfNumber('');
                      }
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                      isActive
                        ? `${tab.activeClass} border-transparent`
                        : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-black ${
                        isActive ? 'bg-white/20 text-white' : tab.badgeClass
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Category + Specific EDF Number Controls */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Category Dropdown */}
                <div className="flex items-center gap-1.5 text-xs">
                  <label htmlFor="report-category" className="text-slate-500 font-semibold">
                    Category:
                  </label>
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

                {/* Specific EDF Number Selector & Input */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label htmlFor="specific-edf-input" className="text-slate-500 font-semibold flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Specific EDF Number:</span>
                  </label>

                  <div className="relative flex items-center">
                    <input
                      id="specific-edf-input"
                      type="text"
                      list="export-edf-number-options"
                      value={specificEdfNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSpecificEdfNumber(val);
                        if (val.trim()) {
                          setSelectedStatus('Specific');
                        }
                      }}
                      placeholder="Type or select EDF # (e.g. 3265)"
                      className="pl-3 pr-7 py-1.5 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <datalist id="export-edf-number-options">
                      {uniqueEdfOptions.map((num) => (
                        <option key={num} value={num} />
                      ))}
                    </datalist>
                    {specificEdfNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          setSpecificEdfNumber('');
                          if (selectedStatus === 'Specific') {
                            setSelectedStatus('Total');
                          }
                        }}
                        className="absolute right-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        title="Clear specific EDF number"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {uniqueEdfOptions.length > 0 && (
                    <select
                      aria-label="Pick existing EDF Number"
                      value={
                        uniqueEdfOptions.some(
                          (opt) => opt.toLowerCase() === specificEdfNumber.trim().toLowerCase()
                        )
                          ? specificEdfNumber.trim()
                          : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setSpecificEdfNumber(val);
                        setSelectedStatus(val ? 'Specific' : 'Total');
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="">Quick Pick EDF #...</option>
                      {uniqueEdfOptions.map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Reset Filters */}
                {(selectedCategory !== 'All' || selectedStatus !== 'Total' || specificEdfNumber.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSelectedStatus('Total');
                      setSpecificEdfNumber('');
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Active scope: <strong className="text-slate-800 dark:text-slate-200">{activeFilterDisplay}</strong>
                {selectedCategory !== 'All' && (
                  <span> • Category: <strong className="text-slate-800 dark:text-slate-200">{selectedCategory}</strong></span>
                )}
              </div>
            </div>
          </div>

          {/* KPI Cards (Strictly Unique EDF Counts) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black tracking-wider text-slate-400 mb-1">
                Fulfillment Rate
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {fulfillmentRate}%
                </span>
                <span className="text-xs text-slate-400 font-medium">of {filtered.length} unique EDF{filtered.length === 1 ? '' : 's'}</span>
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
                Partially Received EDF
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-sky-600 dark:text-sky-400">
                  {partiallyReceivedCount}
                </span>
                <span className="text-xs text-sky-600 font-bold">In-Progress</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Some, but not all items arrived</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black tracking-wider text-slate-400 mb-1">
                Received EDF
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {receivedCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">{pendingCount} Pending EDF</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">All material items verified & in stock</p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-[11px] font-black tracking-wider text-rose-500 mb-1">
                Overdue EDF
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

          {/* Category Breakdown Table (Unique EDF Count) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 dark:text-white tracking-wider">
                Departmental Demand Breakdown (Unique EDF Numbers)
              </h3>
              <span className="text-xs text-slate-400">Filtered distribution</span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-[11px]">
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Unique EDFs</th>
                    <th className="py-3 px-4 text-center">Received</th>
                    <th className="py-3 px-4 text-center">Partially Received</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-4 text-center">Overdue</th>
                    <th className="py-3 px-4 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categories.map((cat) => {
                    const catEdfs = filtered.filter(
                      (e) => String(e.category || '').toLowerCase() === cat.name.toLowerCase()
                    );
                    const catStats = countUniqueEdfStats(catEdfs);
                    const share = filtered.length > 0 ? Math.round((catStats.total / filteredTotal) * 100) : 0;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                          {cat.name}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold font-mono text-slate-900 dark:text-white">
                          {catStats.total}
                        </td>
                        <td className="py-2.5 px-4 text-center font-semibold text-emerald-600">
                          {catStats.received}
                        </td>
                        <td className="py-2.5 px-4 text-center font-semibold text-sky-600">
                          {catStats.partiallyReceived}
                        </td>
                        <td className="py-2.5 px-4 text-center font-semibold text-amber-600">
                          {catStats.pending}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-rose-600">
                          {catStats.overdue}
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

          {/* Grouped Export Preview Table (Vertically Merged EDF Number cell across material rows) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-black text-slate-900 dark:text-white tracking-wider">
                  Export Preview (Grouped by Unique EDF Number)
                </h3>
                <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  {filtered.length} Unique EDF{filtered.length === 1 ? '' : 's'} • {totalMaterialItems} Material Item{totalMaterialItems === 1 ? '' : 's'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200 hover:underline cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer disabled:opacity-40"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-[11px] sticky top-0 z-10">
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">EDF #</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">Requester & Dept</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-center">Dates</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">Material Item</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-center">Qty / Unit</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-center">Item Status</th>
                    <th className="py-2.5 px-3 text-center">EDF Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                        No EDF records match the selected export filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((edf, edfIdx) => {
                      const materials = getEdfMaterialRows(edf);
                      const state = getEffectiveEdfState(edf);
                      const rowGroupClass =
                        edfIdx % 2 === 0
                          ? 'bg-white dark:bg-slate-900'
                          : 'bg-slate-50/70 dark:bg-slate-800/30';

                      return materials.map((mat, matIdx) => {
                        const isFirst = matIdx === 0;
                        return (
                          <tr
                            key={`${edf.id}-${edf.edfNumber}-${matIdx}`}
                            className={`${rowGroupClass} hover:bg-rose-50/30 dark:hover:bg-rose-950/20`}
                          >
                            {isFirst && (
                              <td
                                rowSpan={materials.length}
                                className="py-2.5 px-3 font-mono font-black text-slate-900 dark:text-white align-middle border-r border-slate-200 dark:border-slate-800 whitespace-nowrap"
                              >
                                <div>{edf.edfNumber}</div>
                                <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                  {materials.length} item{materials.length === 1 ? '' : 's'}
                                </div>
                              </td>
                            )}
                            {isFirst && (
                              <td
                                rowSpan={materials.length}
                                className="py-2.5 px-3 align-middle border-r border-slate-200 dark:border-slate-800"
                              >
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {edf.requesterName}
                                </div>
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {edf.category}
                                </span>
                              </td>
                            )}
                            {isFirst && (
                              <td
                                rowSpan={materials.length}
                                className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500 align-middle border-r border-slate-200 dark:border-slate-800 whitespace-nowrap"
                              >
                                <div>Iss: {new Date(edf.issueDate).toLocaleDateString()}</div>
                                <div className="text-slate-700 dark:text-slate-300 font-semibold mt-0.5">
                                  Req: {new Date(edf.requiredDate).toLocaleDateString()}
                                </div>
                              </td>
                            )}
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-200 font-medium border-r border-slate-200 dark:border-slate-800">
                              {mat.itemDescription}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                              {mat.quantity} {mat.unit}
                            </td>
                            <td className="py-2 px-3 text-center border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  mat.status === 'Received'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {mat.status}
                              </span>
                            </td>
                            {isFirst && (
                              <td
                                rowSpan={materials.length}
                                className="py-2.5 px-3 text-center align-middle whitespace-nowrap"
                              >
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                                    state.effectiveStatus === 'Overdue'
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                      : state.effectiveStatus === 'Received'
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                      : state.effectiveStatus === 'Partially Received'
                                      ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  }`}
                                >
                                  {state.effectiveStatus}
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECEIPT & STATUS AUDIT TRAIL LOGS                                */}
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
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Received
                  </button>
                  <button
                    onClick={() => setLogActionFilter('partially_received')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      logActionFilter === 'partially_received'
                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Partially Received
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
                  Permanent record of which Admin or Visitor marked demand forms as Received or Partially Received
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
                      const isReceived = String(log.toStatus).toLowerCase() === 'received' || String(log.toStatus).toLowerCase() === 'completed';
                      const isPartiallyReceived = String(log.toStatus).toLowerCase() === 'partially received';
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Received</span>
                              </span>
                            )}
                            {isPartiallyReceived && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                <PackageCheck className="w-3.5 h-3.5" />
                                <span>Partially Received</span>
                              </span>
                            )}
                            {!isReceived && !isPartiallyReceived && (
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
                              <strong className={isReceived ? 'text-emerald-600' : isPartiallyReceived ? 'text-sky-600' : 'text-slate-700'}>
                                {log.toStatus === 'Completed' ? 'Received' : log.toStatus}
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
