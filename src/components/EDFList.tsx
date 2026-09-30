import React, { useState, useMemo } from 'react';
import { EDF, Category } from '../types.ts';
import { TimerBadge } from './TimerBadge.tsx';
import { HighlightText } from './HighlightText.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { getCategoryBadgeClass } from '../utils/categoryColors.ts';
import {
  Search,
  Filter,
  Download,
  Trash2,
  PackageCheck,
  CheckCircle2,
  Eye,
  Edit,
  PlusCircle,
  AlertOctagon,
  Calendar,
  X,
  RefreshCw,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  AlertTriangle,
  Flame,
  Clock,
  User,
  Layers,
  FileText,
} from 'lucide-react';

export const isEdfHighPriority = (requiredDate: string | Date, status?: string): boolean => {
  if (status === 'Received' || status === 'Completed') return false;
  if (!requiredDate) return false;
  const reqTime = new Date(requiredDate).getTime();
  if (isNaN(reqTime)) return false;
  const now = Date.now();
  const diffMs = reqTime - now;
  // Automatically labeled as High Priority if required date is within 24 hours
  return diffMs <= 24 * 60 * 60 * 1000;
};

interface EDFListProps {
  edfs: EDF[];
  categories: Category[];
  isLoading: boolean;
  onRefresh: () => void;
  onViewDetails: (edf: EDF) => void;
  onEdit: (edf: EDF) => void;
  onDelete: (id: number) => void;
  onMarkStatus: (id: number, status: 'Received' | 'Completed' | 'Pending') => void;
  onBulkAction: (ids: number[], action: 'mark-received' | 'mark-completed' | 'delete') => void;
  onOpenCreate: () => void;
  onExportCSV: (filtered: EDF[]) => void;
  isAdmin: boolean;
  initialCategory?: string;
  initialStatus?: string;
  initialOverdueOnly?: boolean;
}

export const EDFList: React.FC<EDFListProps> = ({
  edfs,
  categories,
  isLoading,
  onRefresh,
  onViewDetails,
  onEdit,
  onDelete,
  onMarkStatus,
  onBulkAction,
  onOpenCreate,
  onExportCSV,
  isAdmin,
  initialCategory = 'All',
  initialStatus = 'All',
  initialOverdueOnly = false,
}) => {
  const { accent } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [overdueOnly, setOverdueOnly] = useState<boolean>(initialOverdueOnly);
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Normal'>('All');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dateFilter, setDateFilter] = useState<string>('all'); // all, today, this-week, this-month

  // Total items currently classified as High Priority (due within 24 hours)
  const highPriorityCount = useMemo(() => {
    return edfs.filter((item) => isEdfHighPriority(item.requiredDate, item.status)).length;
  }, [edfs]);

  // Filtered EDFs
  const filteredEdfs = useMemo(() => {
    return edfs.filter((item) => {
      // Category filter
      if (selectedCategory !== 'All' && item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'All' && item.status.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }

      // Overdue filter
      if (overdueOnly && item.status !== 'Overdue' && !item.isOverdue) {
        return false;
      }

      // Priority filter (High priority: due within 24 hours)
      const isHigh = isEdfHighPriority(item.requiredDate, item.status);
      if (priorityFilter === 'High' && !isHigh) {
        return false;
      }
      if (priorityFilter === 'Normal' && isHigh) {
        return false;
      }

      // Search query (Keyword, EDF Number, Requester Name, Material List, Remarks)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchNumber = item.edfNumber.toLowerCase().includes(q);
        const matchName = item.requesterName.toLowerCase().includes(q);
        const matchCategory = item.category.toLowerCase().includes(q);
        const matchMaterial = item.materialList.toLowerCase().includes(q);
        const matchRemarks = item.remarks ? item.remarks.toLowerCase().includes(q) : false;
        if (!matchNumber && !matchName && !matchCategory && !matchMaterial && !matchRemarks) {
          return false;
        }
      }

      // Date preset filter
      if (dateFilter !== 'all') {
        const itemDate = new Date(item.issueDate);
        const now = new Date();
        if (dateFilter === 'today') {
          if (itemDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'this-week') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
          if (itemDate < oneWeekAgo) return false;
        } else if (dateFilter === 'this-month') {
          if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      return true;
    });
  }, [edfs, selectedCategory, selectedStatus, overdueOnly, priorityFilter, search, dateFilter]);

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredEdfs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEdfs.map((e) => e.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status: string, isOverdue?: boolean) => {
    const s = isOverdue ? 'Overdue' : status;
    switch (s) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Completed</span>
          </span>
        );
      case 'Received':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap">
            <PackageCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>Received</span>
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 animate-pulse whitespace-nowrap">
            <AlertOctagon className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span>Overdue</span>
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Pending</span>
          </span>
        );
    }
  };

  const getPriorityBadge = (priority?: string, isHighPriorityAuto?: boolean) => {
    if (isHighPriorityAuto || priority === 'High') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-950/90 dark:text-red-300 border border-red-300 dark:border-red-800 shadow-2xs whitespace-nowrap"
          title="High Priority: Required date is within 24 hours"
        >
          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 fill-red-500/20 shrink-0" />
          <span>High</span>
        </span>
      );
    }
    if (priority === 'Low') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 whitespace-nowrap">
          Low
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 whitespace-nowrap">
        Medium
      </span>
    );
  };

  const getCategoryColor = (cat: string) => {
    return getCategoryBadgeClass(cat);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar with Keyword indicator */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Keyword, EDF Number, Requester, or Material List..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExportCSV(filteredEdfs)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-all"
              title="Export current filtered list to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onRefresh}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all"
              title="Refresh EDFs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {isAdmin && (
              <button
                onClick={onOpenCreate}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New EDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Search highlight status banner */}
        {search.trim() && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Keyword Highlight active for: <strong className="underline underline-offset-2">"{search.trim()}"</strong> — Found <strong>{filteredEdfs.length}</strong> matching form(s).
              </span>
            </div>
            <button
              onClick={() => setSearch('')}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Received">Received</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400">Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="this-week">Past 7 Days</option>
              <option value="this-month">This Month</option>
            </select>
          </div>

          {/* Overdue checkbox */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:border-red-300 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5 accent-red-500"
            />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              Overdue Only
            </span>
          </label>

          {/* High Priority Filter Button (<24 hours) */}
          <button
            type="button"
            onClick={() => setPriorityFilter(priorityFilter === 'High' ? 'All' : 'High')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              priorityFilter === 'High'
                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400'
            }`}
            title="Filter items with required date within 24 hours"
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                priorityFilter === 'High'
                  ? 'text-white fill-white/20'
                  : 'text-red-600 dark:text-red-400 fill-red-100 dark:fill-red-950'
              }`}
            />
            <span>High Priority ({highPriorityCount})</span>
          </button>

          {/* Reset Filters */}
          {(selectedCategory !== 'All' ||
            selectedStatus !== 'All' ||
            overdueOnly ||
            priorityFilter !== 'All' ||
            search !== '' ||
            dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSelectedStatus('All');
                setOverdueOnly(false);
                setPriorityFilter('All');
                setSearch('');
                setDateFilter('all');
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Actions Floating Bar */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-5 rounded-2xl bg-slate-900 text-white dark:bg-slate-800 dark:border dark:border-slate-700 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-xs font-bold font-mono">
              {selectedIds.length} {selectedIds.length === 1 ? 'EDF' : 'EDFs'} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onBulkAction(selectedIds, 'mark-received')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Mark as Received</span>
            </button>

            <button
              onClick={() => onBulkAction(selectedIds, 'mark-completed')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark as Completed</span>
            </button>

            <button
              onClick={() => {
                if (
                  confirm(
                    `Are you sure you want to delete ${selectedIds.length} selected Demand Forms? This cannot be undone.`
                  )
                ) {
                  onBulkAction(selectedIds, 'delete');
                  setSelectedIds([]);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-slate-400 hover:text-white"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main EDF Data View: Responsive Desktop Table + Mobile Cards */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* DESKTOP & TABLET TABLE VIEW (hidden on mobile <768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                {isAdmin && (
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      onClick={handleSelectAll}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      title="Select all"
                    >
                      {selectedIds.length > 0 && selectedIds.length === filteredEdfs.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                {/* 1. EDF Number */}
                <th className="py-3 px-3 min-w-[130px]">1. EDF Number</th>
                {/* 2. Remarks & Notes */}
                <th className="py-3 px-3 min-w-[150px]">2. Remarks & Notes</th>
                {/* 3. Material Summary */}
                <th className="py-3 px-3 min-w-[190px]">3. Material Summary</th>
                {/* 4. Remaining existing categories/details (Compact Priority, Live Timer, Status) */}
                <th className="py-3 px-2 text-center w-24">Priority</th>
                <th className="py-3 px-2 text-center w-36">Live Timer</th>
                <th className="py-3 px-2 text-center w-28">Status</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Requester</th>
                <th className="py-3 px-3">Issue Date</th>
                <th className="py-3 px-3">Required Date</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filteredEdfs.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 12 : 11}
                    className="py-12 px-4 text-center text-slate-400 dark:text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertOctagon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">
                        No Employee Demand Forms Found
                      </p>
                      <p className="text-xs max-w-sm">
                        Try adjusting your search keywords, category filters, or add a new demand form.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEdfs.map((item) => {
                  const isRowSelected = selectedIds.includes(item.id);
                  const isOverdue = item.status === 'Overdue' || item.isOverdue;
                  const isHighPriority = isEdfHighPriority(item.requiredDate, item.status);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        isOverdue
                          ? 'bg-red-50/40 dark:bg-red-950/25 font-medium border-l-4 border-l-red-600'
                          : isHighPriority
                          ? 'bg-red-50/25 dark:bg-red-950/20 font-medium border-l-4 border-l-red-500'
                          : isRowSelected
                          ? 'bg-indigo-50/30 dark:bg-indigo-950/20'
                          : ''
                      }`}
                    >
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isRowSelected}
                            onChange={() => handleToggleSelect(item.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* 1. EDF Number */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isHighPriority && (
                            <span
                              className="inline-flex items-center justify-center p-0.5 rounded bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800"
                              title="High Priority: Due within 24 hours"
                            >
                              <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 fill-red-500/20 animate-pulse shrink-0" />
                            </span>
                          )}
                          <button
                            onClick={() => onViewDetails(item)}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                            title="Click to view full details"
                          >
                            <HighlightText text={item.edfNumber} query={search} />
                          </button>
                        </div>
                      </td>

                      {/* 2. Remarks & Notes */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[170px] truncate" title={item.remarks || undefined}>
                        {item.remarks ? (
                          <HighlightText text={item.remarks} query={search} />
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* 3. Material Summary: Material -> Unit -> Quantity */}
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-[220px]">
                        <div className="truncate font-medium" title={item.materialList}>
                          <HighlightText text={item.materialList} query={search} />
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <span>Unit: <strong className="text-slate-600 dark:text-slate-300 font-semibold">{item.unit}</strong></span>
                          <span>&bull;</span>
                          <span>Qty: <strong className="text-slate-800 dark:text-slate-200 font-bold">{item.quantity}</strong></span>
                          {item.items && item.items.length > 1 && (
                            <span className="ml-1 px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-sans">
                              +{item.items.length - 1} rows
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Remaining: Compact Priority Level */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {getPriorityBadge(item.priority, isHighPriority)}
                      </td>

                      {/* 4. Remaining: Compact Live Timer */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <TimerBadge requiredDate={item.requiredDate} status={item.status} compact />
                      </td>

                      {/* 4. Remaining: Compact Status */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {getStatusBadge(item.status, item.isOverdue)}
                      </td>

                      {/* 4. Remaining: Category with Domain Colors */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getCategoryColor(
                            item.category
                          )}`}
                        >
                          <HighlightText text={item.category} query={search} />
                        </span>
                      </td>

                      {/* 4. Remaining: Requester */}
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                        <HighlightText text={item.requesterName} query={search} />
                      </td>

                      {/* 4. Remaining: Issue Date */}
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(item.issueDate).toLocaleDateString()}
                      </td>

                      {/* 4. Remaining: Required Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                        <span
                          className={`font-medium ${
                            isHighPriority
                              ? 'text-red-600 dark:text-red-400 font-bold'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {new Date(item.requiredDate).toLocaleDateString()}
                        </span>
                      </td>

                      {/* 4. Remaining: Actions (Available to both Admin and Viewer) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View details */}
                          <button
                            onClick={() => onViewDetails(item)}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Mark Received (Available to BOTH Admin and Viewer!) */}
                          {item.status !== 'Received' && item.status !== 'Completed' && (
                            <button
                              onClick={() => onMarkStatus(item.id, 'Received')}
                              className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                              title="Mark as Received (Stops live timer)"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAdmin && (
                            <>
                              <button
                                onClick={() => onEdit(item)}
                                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Edit EDF"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {item.status !== 'Completed' && (
                                <button
                                  onClick={() => onMarkStatus(item.id, 'Completed')}
                                  className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                                  title="Mark as Completed"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Are you sure you want to delete ${item.edfNumber}? This cannot be undone.`
                                    )
                                  ) {
                                    onDelete(item.id);
                                  }
                                }}
                                className="p-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                title="Delete EDF"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE RESPONSIVE CARDS VIEW (Visible only on <768px screens, tested for 320px, 375px, 390px, 430px) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredEdfs.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-400 dark:text-slate-500">
              <AlertOctagon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                No Employee Demand Forms Found
              </p>
              <p className="text-xs mt-1">Try resetting filters or search keywords.</p>
            </div>
          ) : (
            filteredEdfs.map((item) => {
              const isOverdue = item.status === 'Overdue' || item.isOverdue;
              const isHighPriority = isEdfHighPriority(item.requiredDate, item.status);

              return (
                <div
                  key={item.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isOverdue
                      ? 'bg-red-50/40 dark:bg-red-950/20 border-l-4 border-l-red-600'
                      : isHighPriority
                      ? 'bg-red-50/25 dark:bg-red-950/15 border-l-4 border-l-red-500'
                      : ''
                  }`}
                >
                  {/* Row 1: EDF Number + Status & Priority Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => onViewDetails(item)}
                        className="font-mono font-black text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left cursor-pointer"
                      >
                        <HighlightText text={item.edfNumber} query={search} />
                      </button>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryColor(
                          item.category
                        )}`}
                      >
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {getPriorityBadge(item.priority, isHighPriority)}
                      {getStatusBadge(item.status, item.isOverdue)}
                    </div>
                  </div>

                  {/* Row 2: Remarks & Notes */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      2. Remarks & Notes
                    </span>
                    <p className="text-slate-700 dark:text-slate-300">
                      {item.remarks ? (
                        <HighlightText text={item.remarks} query={search} />
                      ) : (
                        <span className="text-slate-400 italic">No notes provided</span>
                      )}
                    </p>
                  </div>

                  {/* Row 3: Material Summary (Material -> Unit -> Quantity) */}
                  <div className="bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      3. Material Summary
                    </span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      <HighlightText text={item.materialList} query={search} />
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-1">
                      <span>Unit: <strong className="text-slate-700 dark:text-slate-300">{item.unit}</strong></span>
                      <span>Qty: <strong className="text-slate-900 dark:text-white font-bold">{item.quantity}</strong></span>
                      {item.items && item.items.length > 1 && (
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold font-sans">
                          +{item.items.length - 1} more items
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Remaining Details (Requester, Dates, Live Timer) */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Requester:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                        <HighlightText text={item.requesterName} query={search} />
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Required Date:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {new Date(item.requiredDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold">Live Countdown:</span>
                      <TimerBadge requiredDate={item.requiredDate} status={item.status} compact />
                    </div>
                  </div>

                  {/* Row 5: Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => onViewDetails(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View Details</span>
                    </button>

                    {/* Both Admin and Viewer can mark Received */}
                    {item.status !== 'Received' && item.status !== 'Completed' && (
                      <button
                        onClick={() => onMarkStatus(item.id, 'Received')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Mark Received</span>
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => onEdit(item)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${item.edfNumber}?`)) {
                              onDelete(item.id);
                            }
                          }}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 text-xs cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info summary */}
        <div className="p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredEdfs.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{edfs.length}</strong> demands
            {search.trim() && (
              <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">
                (Filtered by search term)
              </span>
            )}
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Relational DB Engine Active
          </span>
        </div>
      </div>
    </div>
  );
};
