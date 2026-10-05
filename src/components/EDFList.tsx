import React, { useState, useMemo } from 'react';
import { EDF, Category, EDFItem } from '../types.ts';
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
  ChevronDown,
  ChevronUp,
  Check,
  Undo2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export const isDueWithin24Hours = (requiredDate: string | Date, status?: string): boolean => {
  if (status === 'Received') return false;
  if (!requiredDate) return false;
  const reqTime = new Date(requiredDate).getTime();
  if (isNaN(reqTime)) return false;
  const now = Date.now();
  const diffMs = reqTime - now;
  return diffMs <= 24 * 60 * 60 * 1000 && diffMs > 0;
};

interface EDFListProps {
  edfs: EDF[];
  categories: Category[];
  isLoading: boolean;
  onRefresh: () => void;
  onViewDetails: (edf: EDF) => void;
  onEdit: (edf: EDF) => void;
  onDelete: (id: number) => void;
  onMarkStatus: (id: number, status: 'Received' | 'Partially Received' | 'Pending') => void;
  onReceiveItems?: (edfId: number, itemIds: number[]) => Promise<void>;
  onUndoItemReceived?: (edfId: number, itemId: number) => Promise<void>;
  onBulkAction: (ids: number[], action: 'mark-received' | 'delete') => void;
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
  onReceiveItems,
  onUndoItemReceived,
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dateFilter, setDateFilter] = useState<string>('all'); // all, today, this-week, this-month

  // Expandable row & inline item receiving states
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [isReceivingItems, setIsReceivingItems] = useState(false);
  const [undoConfirmItem, setUndoConfirmItem] = useState<{ edfId: number; item: EDFItem } | null>(null);
  const [isUndoingItem, setIsUndoingItem] = useState(false);

  // Filtered EDFs
  const filteredEdfs = useMemo(() => {
    return edfs.filter((item) => {
      // Category filter
      if (selectedCategory !== 'All' && item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'All') {
        const selLower = selectedStatus.toLowerCase();
        if (selLower === 'overdue') {
          if (item.status !== 'Overdue' && !item.isOverdue) return false;
        } else if (selLower === 'partially received') {
          const rawItems = item.items || [];
          const totalCount = item.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
          const receivedCount = item.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;
          const isPartial = item.status === 'Partially Received' || (receivedCount > 0 && receivedCount < totalCount);
          if (!isPartial) return false;
        } else if (selLower === 'received') {
          const rawItems = item.items || [];
          const totalCount = item.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
          const receivedCount = item.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;
          const isReceived = item.status === 'Received' || (receivedCount >= totalCount && totalCount > 0);
          if (!isReceived) return false;
        } else if (selLower === 'pending') {
          const rawItems = item.items || [];
          const totalCount = item.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
          const receivedCount = item.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;
          const isPending = (item.status === 'Pending' || item.status === 'Overdue') && receivedCount === 0;
          if (!isPending) return false;
        } else if (item.status.toLowerCase() !== selLower) {
          return false;
        }
      }

      // Overdue filter
      if (overdueOnly && item.status !== 'Overdue' && !item.isOverdue) {
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
  }, [edfs, selectedCategory, selectedStatus, overdueOnly, search, dateFilter]);

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
      case 'Received':
        return (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Received</span>
          </span>
        );
      case 'Partially Received':
        return (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 whitespace-nowrap">
            <PackageCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Partially Received</span>
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 animate-pulse whitespace-nowrap">
            <AlertOctagon className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
            <span>Overdue</span>
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Pending</span>
          </span>
        );
    }
  };

  // Compact receiving indicator (Requirement 5)
  const renderReceivingBadge = (item: EDF) => {
    const rawItems = item.items || [];
    const totalCount = item.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
    const receivedCount = item.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;
    const isPartial = receivedCount > 0 && receivedCount < totalCount;
    const allReceived = totalCount > 0 && receivedCount === totalCount;

    if (allReceived || item.status === 'Received') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap"
          title="All items received"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Received — {totalCount}/{totalCount}</span>
        </span>
      );
    }

    if (isPartial || item.status === 'Partially Received') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap"
          title="Partially Received"
        >
          <PackageCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Partially Received — {receivedCount}/{totalCount} Received</span>
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50/80 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap"
        title="Pending receiving"
      >
        <Clock className="w-3 h-3 text-amber-500 shrink-0" />
        <span>Pending — 0/{totalCount} Received</span>
      </span>
    );
  };

  // Toggle item selection in inline expanded row
  const handleToggleItemInEdf = (itemId: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // Toggle select all pending items for an EDF
  const handleToggleSelectAllInEdf = (items: EDFItem[]) => {
    const pendingIds = items.filter((i) => i.status !== 'Received' && i.id).map((i) => i.id!);
    if (selectedItemIds.length === pendingIds.length && pendingIds.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(pendingIds);
    }
  };

  // Submit receiving in inline expanded row
  const handleSubmitInlineReceiving = async (edfId: number) => {
    if (selectedItemIds.length === 0 || !onReceiveItems) return;
    setIsReceivingItems(true);
    try {
      await onReceiveItems(edfId, selectedItemIds);
      setSelectedItemIds([]);
    } catch (err) {
      console.error('Error submitting receiving:', err);
    } finally {
      setIsReceivingItems(false);
    }
  };

  // Confirm undo receiving for an item
  const handleConfirmInlineUndo = async () => {
    if (!undoConfirmItem?.item.id || !onUndoItemReceived) return;
    setIsUndoingItem(true);
    try {
      await onUndoItemReceived(undoConfirmItem.edfId, undoConfirmItem.item.id);
      setUndoConfirmItem(null);
    } catch (err) {
      console.error('Error undoing item receiving:', err);
    } finally {
      setIsUndoingItem(false);
    }
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
              <option value="Partially Received">Partially Received</option>
              <option value="Received">Received</option>
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

          {/* Reset Filters */}
          {(selectedCategory !== 'All' ||
            selectedStatus !== 'All' ||
            overdueOnly ||
            search !== '' ||
            dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSelectedStatus('All');
                setOverdueOnly(false);
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
      <div className="w-full min-w-0 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* DESKTOP & TABLET TABLE VIEW (hidden on mobile <768px) */}
        <div className="hidden md:block w-full min-w-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 text-[11px] font-bold tracking-wide">
                {isAdmin && (
                  <th className="py-2.5 px-2 w-8 text-center">
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
                {/* 1. Edf Number */}
                <th className="py-2.5 px-2.5 min-w-[110px]">1. EDF Number</th>
                {/* 2. Remarks & Notes */}
                <th className="py-2.5 px-2.5 min-w-[130px]">2. Remarks & Notes</th>
                {/* 3. Material Summary */}
                <th className="py-2.5 px-2.5 min-w-[170px]">3. Material Summary</th>
                {/* 4. Priority */}
                <th className="py-2.5 px-2 text-center w-20 text-xs font-semibold">4. Priority</th>
                {/* 5. Live Timer */}
                <th className="py-2.5 px-2 text-center w-28 text-xs font-semibold">5. Live Timer</th>
                {/* 6. Status */}
                <th className="py-2.5 px-2 text-center w-28 text-xs font-semibold">6. Status</th>
                <th className="py-2.5 px-2.5">Category</th>
                <th className="py-2.5 px-2.5">Requester</th>
                <th className="py-2.5 px-2.5">Request Date</th>
                <th className="py-2.5 px-2.5">Required Date</th>
                <th className="py-2.5 px-2.5 text-right">Actions</th>
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
                  const isDueSoon = isDueWithin24Hours(item.requiredDate, item.status);

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`transition-colors group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        isOverdue
                          ? 'bg-red-50/40 dark:bg-red-950/25 font-medium border-l-4 border-l-red-600'
                          : isDueSoon
                          ? 'bg-amber-50/25 dark:bg-amber-950/20 font-medium border-l-4 border-l-amber-500'
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
                          {isDueSoon && (
                            <span
                              className="inline-flex items-center justify-center p-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                              title="Due within 24 hours"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-amber-500/20 shrink-0" />
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

                      {/* 4. Priority */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap text-xs">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          item.priority === 'High'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                            : item.priority === 'Low'
                            ? 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                        }`}>
                          {item.priority || 'Medium'}
                        </span>
                      </td>

                      {/* 5. Live Timer */}
                      <td className="py-1.5 px-1 text-center whitespace-nowrap text-xs">
                        <TimerBadge requiredDate={item.requiredDate} status={item.status} compact />
                      </td>

                      {/* 6. Status & Receiving Indicator */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap text-xs">
                        <div className="flex flex-col items-center gap-1">
                          {getStatusBadge(item.status, item.isOverdue)}
                          {renderReceivingBadge(item)}
                        </div>
                      </td>

                      {/* Remaining: Category with Domain Colors */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getCategoryColor(
                            item.category
                          )}`}
                        >
                          <HighlightText text={item.category} query={search} />
                        </span>
                      </td>

                      {/* Requester */}
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                        <HighlightText text={item.requesterName} query={search} />
                      </td>

                      {/* Issue Date */}
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(item.issueDate).toLocaleDateString()}
                      </td>

                      {/* Required Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                        <span
                          className={`font-medium ${
                            isDueSoon
                              ? 'text-amber-600 dark:text-amber-400 font-bold'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {new Date(item.requiredDate).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Actions (Available to both Admin and Viewer) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle Material Items Checklist (Item-level receiving for Admin & Viewer) */}
                          <button
                            onClick={() => {
                              if (expandedRowId === item.id) {
                                setExpandedRowId(null);
                                setSelectedItemIds([]);
                              } else {
                                setExpandedRowId(item.id);
                                setSelectedItemIds([]);
                              }
                            }}
                            className={`p-1 rounded-lg text-xs font-semibold flex items-center gap-0.5 transition-colors cursor-pointer ${
                              expandedRowId === item.id
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200'
                                : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title="Open item receiving checklist"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <ChevronDown
                              className={`w-3 h-3 transition-transform ${
                                expandedRowId === item.id ? 'rotate-180 text-indigo-600' : ''
                              }`}
                            />
                          </button>

                          {/* View details */}
                          <button
                            onClick={() => onViewDetails(item)}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Mark Received (Available to BOTH Admin and Viewer!) */}
                          {item.status !== 'Received' && (
                            <button
                              onClick={() => onMarkStatus(item.id, 'Received')}
                              className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                              title="Mark as Received (Completes EDF and stops timer)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
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

                    {/* Inline Material Items Checklist Row */}
                    {expandedRowId === item.id && (
                      <tr key={`expanded-${item.id}`} className="bg-indigo-50/20 dark:bg-slate-950/70 border-y-2 border-indigo-200 dark:border-indigo-900/60">
                        <td colSpan={isAdmin ? 12 : 11} className="p-3 sm:p-5">
                          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950 shadow-sm space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                              <div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>Material Checklist — {item.edfNumber}</span>
                                  {renderReceivingBadge(item)}
                                </h4>
                                <p className="text-[11px] text-slate-400">
                                  Check individual arrived items. Both Admin and Viewer can mark items received.
                                </p>
                              </div>

                              {item.items && item.items.filter((i) => i.status !== 'Received').length > 0 && onReceiveItems && (
                                <button
                                  type="button"
                                  onClick={() => handleSubmitInlineReceiving(item.id)}
                                  disabled={selectedItemIds.length === 0 || isReceivingItems}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                                >
                                  {isReceivingItems ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Saving...</span>
                                    </>
                                  ) : (
                                    <>
                                      <PackageCheck className="w-3.5 h-3.5" />
                                      <span>Mark Selected Items as Received ({selectedItemIds.length})</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Items Table */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-[10px]">
                                    <th className="py-2 px-3 w-10 text-center">
                                      <input
                                        type="checkbox"
                                        aria-label="Select all pending items"
                                        checked={
                                          (item.items || []).filter((i) => i.status !== 'Received').length > 0 &&
                                          selectedItemIds.length === (item.items || []).filter((i) => i.status !== 'Received').length
                                        }
                                        onChange={() => handleToggleSelectAllInEdf(item.items || [])}
                                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                                      />
                                    </th>
                                    <th className="py-2 px-3">Material</th>
                                    <th className="py-2 px-3 w-20 text-right">Unit</th>
                                    <th className="py-2 px-3 w-20 text-right">Quantity</th>
                                    <th className="py-2 px-3 w-28 text-center">Status</th>
                                    <th className="py-2 px-3 min-w-[160px]">Receiving Info & Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {(item.items && item.items.length > 0
                                    ? item.items
                                    : [
                                        {
                                          id: 0,
                                          itemDescription: item.materialList,
                                          quantity: item.quantity,
                                          unit: item.unit,
                                          status: (item.status === 'Received' ? 'Received' : 'Pending') as 'Pending' | 'Received',
                                          receivedAt: null,
                                          receivedBy: null,
                                        } as EDFItem,
                                      ]
                                  ).map((it: EDFItem, idx) => {
                                    const isReceived = it.status === 'Received';
                                    const isChecked = Boolean(it.id && selectedItemIds.includes(it.id));

                                    return (
                                      <tr
                                        key={it.id || idx}
                                        className={
                                          isReceived
                                            ? 'bg-emerald-50/30 dark:bg-emerald-950/20'
                                            : isChecked
                                            ? 'bg-blue-50/40 dark:bg-blue-950/25'
                                            : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                                        }
                                      >
                                        <td className="py-2 px-3 text-center">
                                          {isReceived ? (
                                            <div className="w-3.5 h-3.5 rounded bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-2xs">
                                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                                            </div>
                                          ) : it.id ? (
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleItemInEdf(it.id!)}
                                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                                            />
                                          ) : (
                                            <span className="text-[10px] text-slate-400 font-mono">{idx + 1}</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                                          {it.itemDescription}
                                        </td>
                                        <td className="py-2 px-3 text-right text-slate-500">{it.unit}</td>
                                        <td className="py-2 px-3 font-mono font-bold text-right text-slate-900 dark:text-white">
                                          {it.quantity}
                                        </td>
                                        <td className="py-2 px-3 text-center whitespace-nowrap">
                                          {isReceived ? (
                                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                              <Check className="w-2.5 h-2.5" />
                                              <span>Received</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                              <Clock className="w-2.5 h-2.5 text-amber-600" />
                                              <span>Pending</span>
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-[11px]">
                                          {isReceived ? (
                                            <div className="flex items-center justify-between gap-1 flex-wrap">
                                              <span className="text-slate-400 text-[10px]">
                                                {it.receivedAt ? new Date(it.receivedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recorded'}
                                                {it.receivedBy && ` • ${it.receivedBy}`}
                                              </span>
                                              {it.id && onUndoItemReceived && (
                                                <button
                                                  type="button"
                                                  onClick={() => setUndoConfirmItem({ edfId: item.id, item: it })}
                                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                                >
                                                  <Undo2 className="w-2.5 h-2.5" />
                                                  <span>Undo</span>
                                                </button>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-slate-400 italic text-[10px]">Pending arrival</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
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
              const isDueSoon = isDueWithin24Hours(item.requiredDate, item.status);

              return (
                <div
                  key={item.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isOverdue
                      ? 'bg-red-50/40 dark:bg-red-950/20 border-l-4 border-l-red-600'
                      : isDueSoon
                      ? 'bg-amber-50/25 dark:bg-amber-950/15 border-l-4 border-l-amber-500'
                      : ''
                  }`}
                >
                  {/* Row 1: EDF Number + Status & Receiving Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isDueSoon && (
                        <span
                          className="inline-flex items-center justify-center p-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                          title="Due within 24 hours"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-amber-500/20 shrink-0" />
                        </span>
                      )}
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

                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {getStatusBadge(item.status, item.isOverdue)}
                      {renderReceivingBadge(item)}
                    </div>
                  </div>

                  {/* Row 2: Remarks & Notes */}
                  <div className="bg-slate-50/70 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider block mb-0.5">
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
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider block mb-0.5">
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
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                    <button
                      onClick={() => onViewDetails(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View Details</span>
                    </button>

                    {/* Toggle Items Checklist button */}
                    <button
                      onClick={() => {
                        setExpandedRowId(expandedRowId === item.id ? null : item.id);
                        setSelectedItemIds([]);
                      }}
                      className="flex items-center justify-center gap-1 py-2.5 px-3 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      title="Item receiving checklist"
                    >
                      <PackageCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Checklist</span>
                    </button>

                    {/* Both Admin and Viewer can mark Received */}
                    {item.status !== 'Received' && (
                      <button
                        onClick={() => onMarkStatus(item.id, 'Received')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Mark All Received</span>
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => onEdit(item)}
                          className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs cursor-pointer"
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
                          className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 text-xs cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Inline Material Items Checklist for Mobile */}
                  {expandedRowId === item.id && (
                    <div className="p-3 rounded-2xl bg-indigo-50/30 dark:bg-slate-950/80 border border-indigo-200 dark:border-indigo-900/60 space-y-2 mt-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Material Checklist
                        </span>
                        {item.items && item.items.filter((i) => i.status !== 'Received').length > 0 && onReceiveItems && (
                          <button
                            type="button"
                            onClick={() => handleSubmitInlineReceiving(item.id)}
                            disabled={selectedItemIds.length === 0 || isReceivingItems}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] disabled:opacity-50"
                          >
                            Mark Selected ({selectedItemIds.length})
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                        {(item.items || []).map((it, idx) => {
                          const isReceived = it.status === 'Received';
                          const isChecked = Boolean(it.id && selectedItemIds.includes(it.id));

                          return (
                            <div key={it.id || idx} className="pt-1.5 flex items-start justify-between gap-2 text-xs">
                              <div className="flex items-start gap-2">
                                {isReceived ? (
                                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                ) : it.id ? (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleItemInEdf(it.id!)}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 accent-blue-600 shrink-0 mt-0.5"
                                  />
                                ) : null}
                                <div>
                                  <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                                    {it.itemDescription}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    {it.quantity} {it.unit}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                {isReceived ? (
                                  <div>
                                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                      ✓ Received
                                    </span>
                                    {it.id && onUndoItemReceived && (
                                      <button
                                        type="button"
                                        onClick={() => setUndoConfirmItem({ edfId: item.id, item: it })}
                                        className="block text-[10px] text-rose-600 font-bold hover:underline mt-0.5"
                                      >
                                        Undo
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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

      {/* CONFIRMATION DIALOG FOR "UNDO RECEIVED" (Requirement 10) */}
      {undoConfirmItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Undo Item Receiving?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Are you sure you want to mark{' '}
                  <strong className="text-slate-900 dark:text-white">
                    &quot;{undoConfirmItem.item.itemDescription}&quot;
                  </strong>{' '}
                  as <strong>Pending</strong> again?
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  This will safely recalculate the EDF delivery status without removing any past receiving history.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isUndoingItem}
                onClick={() => setUndoConfirmItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isUndoingItem}
                onClick={handleConfirmInlineUndo}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isUndoingItem ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reverting...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Confirm Undo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
