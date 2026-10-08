import React, { useState, useMemo } from 'react';
import { EDF, Category, EDFStatus } from '../types.ts';
import { TimerBadge } from './TimerBadge.tsx';
import { calculateLiveTimer } from '../utils/timer.ts';
import { getCategoryBadgeClass } from '../utils/categoryColors.ts';
import {
  Clock,
  PackageCheck,
  CheckCircle2,
  Search,
  Filter,
  AlertCircle,
  PlusCircle,
  GripVertical,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Eye,
  Edit,
  User,
  Calendar,
  Layers,
  Sparkles,
  X,
  Kanban,
  Check,
} from 'lucide-react';

interface KanbanBoardProps {
  edfs: EDF[];
  categories: Category[];
  onViewEdf: (edf: EDF) => void;
  onEditEdf?: (edf: EDF) => void;
  onOpenCreate: () => void;
  onMarkStatus: (id: number, status: 'Pending' | 'Partially Received' | 'Received') => Promise<void> | void;
  isAdmin: boolean;
}

type ColumnKey = 'Pending' | 'Partially Received' | 'Received';

interface ColumnConfig {
  key: ColumnKey;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  headerBg: string;
  badgeBg: string;
  dropRing: string;
  iconColor: string;
  indicatorColor: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    key: 'Pending',
    title: 'Pending',
    subtitle: '0 items received',
    icon: Clock,
    headerBg: 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-200 dark:border-amber-900/50',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    dropRing: 'ring-2 ring-amber-500/60 bg-amber-50/40 dark:bg-amber-950/20 border-amber-400',
    iconColor: 'text-amber-600 dark:text-amber-400',
    indicatorColor: 'bg-amber-500',
  },
  {
    key: 'Partially Received',
    title: 'Partially Received',
    subtitle: 'Some items received',
    icon: PackageCheck,
    headerBg: 'bg-sky-500/10 dark:bg-sky-500/15 border-sky-200 dark:border-sky-900/50',
    badgeBg: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300 dark:border-sky-800',
    dropRing: 'ring-2 ring-sky-500/60 bg-sky-50/40 dark:bg-sky-950/20 border-sky-400',
    iconColor: 'text-sky-600 dark:text-sky-400',
    indicatorColor: 'bg-sky-500',
  },
  {
    key: 'Received',
    title: 'Received',
    subtitle: 'All items received & verified',
    icon: CheckCircle2,
    headerBg: 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-900/50',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    dropRing: 'ring-2 ring-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    indicatorColor: 'bg-emerald-500',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  edfs,
  categories,
  onViewEdf,
  onEditEdf,
  onOpenCreate,
  onMarkStatus,
  isAdmin,
}) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [mobileActiveColumn, setMobileActiveColumn] = useState<ColumnKey | 'All'>('All');

  // Drag and Drop States
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<number | null>(null);

  // Filter EDFs based on search and filters
  const filteredEdfs = useMemo(() => {
    return edfs.filter((item) => {
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesQuery =
          item.edfNumber.toLowerCase().includes(query) ||
          item.requesterName.toLowerCase().includes(query) ||
          item.materialList.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          (item.remarks && item.remarks.toLowerCase().includes(query));

        if (!matchesQuery) return false;
      }

      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // Overdue filter
      if (overdueOnly) {
        const timer = calculateLiveTimer(item.requiredDate);
        const isOverdue = timer.isOverdue || item.status === 'Overdue' || item.isOverdue;
        if (!isOverdue) return false;
      }

      return true;
    });
  }, [edfs, searchTerm, selectedCategory, overdueOnly]);

  // Group into columns
  const columnsData = useMemo(() => {
    const pendingList: EDF[] = [];
    const partiallyReceivedList: EDF[] = [];
    const receivedList: EDF[] = [];

    for (const item of filteredEdfs) {
      const totalItems = item.totalItemsCount ?? (item.items ? item.items.length : 1);
      const receivedItems =
        item.receivedItemsCount ??
        (item.items
          ? item.items.filter((i) => i.status === 'Received').length
          : item.status === 'Received'
            ? totalItems
            : 0);

      if (receivedItems >= totalItems && totalItems > 0) {
        receivedList.push(item);
      } else if (receivedItems > 0 && receivedItems < totalItems) {
        partiallyReceivedList.push(item);
      } else if (item.status === 'Received') {
        receivedList.push(item);
      } else if (item.status === 'Partially Received') {
        partiallyReceivedList.push(item);
      } else {
        pendingList.push(item);
      }
    }

    return {
      Pending: pendingList,
      'Partially Received': partiallyReceivedList,
      Received: receivedList,
    };
  }, [filteredEdfs]);

  // Total counts & percentages
  const totalCount = edfs.length;
  const pendingCount = columnsData.Pending.length;
  const partiallyReceivedCount = columnsData['Partially Received'].length;
  const receivedCount = columnsData.Received.length;
  const overdueTotalCount = edfs.filter((e) => {
    if (e.status === 'Received') return false;
    const timer = calculateLiveTimer(e.requiredDate, e.status);
    return timer.isOverdue || e.status === 'Overdue' || e.isOverdue;
  }).length;

  const pendingPct = totalCount ? Math.round((pendingCount / totalCount) * 100) : 0;
  const partiallyReceivedPct = totalCount ? Math.round((partiallyReceivedCount / totalCount) * 100) : 0;
  const receivedPct = totalCount ? Math.round((receivedCount / totalCount) * 100) : 0;

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, id: number) => {
    if (!isAdmin) return;
    setDraggingId(id);
    e.dataTransfer.setData('text/plain', String(id));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colKey: ColumnKey) => {
    e.preventDefault();
    if (!isAdmin) return;
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colKey) {
      setDragOverColumn(colKey);
    }
  };

  const handleDragLeave = (colKey: ColumnKey) => {
    if (dragOverColumn === colKey) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetCol: ColumnKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    const idStr = e.dataTransfer.getData('text/plain');
    const id = idStr ? parseInt(idStr, 10) : draggingId;
    setDraggingId(null);

    if (!id || !isAdmin) return;

    const item = edfs.find((x) => x.id === id);
    if (!item) return;

    // Normalizing current status
    const currentStatus: ColumnKey =
      item.status === 'Received'
        ? 'Received'
        : item.status === 'Partially Received'
          ? 'Partially Received'
          : 'Pending';

    if (currentStatus === targetCol) return;

    try {
      setIsUpdatingStatus(id);
      await onMarkStatus(id, targetCol);
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleQuickStatus = async (id: number, targetCol: ColumnKey) => {
    if (!isAdmin && targetCol !== 'Received') return;
    try {
      setIsUpdatingStatus(id);
      await onMarkStatus(id, targetCol);
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const hasActiveFilters = searchTerm !== '' || selectedCategory !== 'All' || overdueOnly;

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Top Header & Metrics Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs w-full min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                <Kanban className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  Demand Form Kanban Board
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drag and drop demand forms between workflow stages or use one-click status transitions
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <button
                onClick={onOpenCreate}
                className="flex items-center gap-2 px-4 py-2.5 min-h-[40px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Demand Form</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress & Distribution Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs mb-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Total Active Workflow: <strong className="font-mono text-slate-900 dark:text-white">{totalCount}</strong> forms
            </span>

            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Pending: {pendingCount} ({pendingPct}%)
              </span>
              <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                Partially Received: {partiallyReceivedCount} ({partiallyReceivedPct}%)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Received: {receivedCount} ({receivedPct}%)
              </span>
            </div>
          </div>

          {/* Segmented bar */}
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${pendingPct}%` }}
              className="bg-amber-500 transition-all duration-500 hover:brightness-110"
              title={`Pending: ${pendingCount} (${pendingPct}%)`}
            />
            <div
              style={{ width: `${partiallyReceivedPct}%` }}
              className="bg-sky-500 transition-all duration-500 hover:brightness-110"
              title={`Partially Received: ${partiallyReceivedCount} (${partiallyReceivedPct}%)`}
            />
            <div
              style={{ width: `${receivedPct}%` }}
              className="bg-emerald-500 transition-all duration-500 hover:brightness-110"
              title={`Received: ${receivedCount} (${receivedPct}%)`}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex-1 w-full md:w-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by EDF#, requester, material, or keyword..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Overdue Only Filter */}
          <button
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              overdueOnly
                ? 'bg-red-50 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <AlertCircle className={`w-3.5 h-3.5 ${overdueOnly ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
            <span>Overdue Only</span>
            {overdueTotalCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-black">
                {overdueTotalCount}
              </span>
            )}
          </button>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setOverdueOnly(false);
              }}
              className="px-2.5 py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
              title="Reset all filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Mobile Column Tab Switcher (Visible on mobile/tablet <lg screens) */}
      <div className="flex lg:hidden items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 mb-2 gap-1 overflow-x-auto">
        {COLUMNS.map((col) => {
          const ColIcon = col.icon;
          const isActive = mobileActiveColumn === col.key;
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => setMobileActiveColumn(col.key)}
              className={`flex-1 py-2 px-2 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ColIcon className="w-3.5 h-3.5" />
              <span>{col.title}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${col.badgeBg}`}>
                {columnsData[col.key].length}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileActiveColumn('All')}
          className={`py-2 px-3 text-center rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            mobileActiveColumn === 'All'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          All
        </button>
      </div>

      {/* Kanban 3-Column Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start w-full min-w-0">
        {COLUMNS.map((col) => {
          const colItems = columnsData[col.key];
          const isOver = dragOverColumn === col.key;
          const ColIcon = col.icon;

          return (
            <div
              key={col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={() => handleDragLeave(col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
              className={`flex-col rounded-3xl bg-slate-100/60 dark:bg-slate-950/50 border transition-all duration-200 min-h-[480px] lg:min-h-[580px] ${
                mobileActiveColumn !== 'All' && mobileActiveColumn !== col.key
                  ? 'hidden lg:flex'
                  : 'flex'
              } ${
                isOver
                  ? `${col.dropRing} border-dashed`
                  : 'border-slate-200/90 dark:border-slate-800'
              }`}
            >
              {/* Column Header */}
              <div
                className={`p-4 rounded-t-3xl border-b flex items-center justify-between ${col.headerBg}`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3 h-3 rounded-full ${col.indicatorColor} ring-4 ring-white dark:ring-slate-900 shadow-xs`}
                  />
                  <div className="flex items-center gap-1.5">
                    <ColIcon className={`w-4 h-4 ${col.iconColor}`} />
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {col.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono ${col.badgeBg}`}
                  >
                    {colItems.length}
                  </span>
                </div>
              </div>

              {/* Sub-header description */}
              <div className="px-4 py-2 text-[11px] text-slate-400 border-b border-slate-200/50 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/30">
                {col.subtitle}
              </div>

              {/* Column Cards Container */}
              <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto max-h-[750px]">
                {/* Visual Drop Area Helper when Dragging */}
                {isOver && draggingId && (
                  <div className="p-4 rounded-2xl border-2 border-dashed border-indigo-400 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-center animate-pulse-subtle">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      Drop here to move to {col.title}
                    </p>
                  </div>
                )}

                {colItems.length === 0 ? (
                  <div className="py-12 px-4 text-center rounded-2xl bg-white/40 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800">
                    <ColIcon className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      No {col.title.toLowerCase()} demand forms
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isAdmin ? 'Drag cards here to update status' : 'No records match this stage'}
                    </p>
                  </div>
                ) : (
                  colItems.map((edf) => {
                    const timer = calculateLiveTimer(edf.requiredDate);
                    const isOverdue = timer.isOverdue || edf.status === 'Overdue' || !!edf.isOverdue;
                    const isDragging = draggingId === edf.id;
                    const isUpdating = isUpdatingStatus === edf.id;

                    return (
                      <div
                        key={edf.id}
                        draggable={isAdmin}
                        onDragStart={(e) => handleDragStart(e, edf.id)}
                        onDragEnd={handleDragEnd}
                        className={`group relative p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-150 ${
                          isDragging
                            ? 'opacity-40 scale-95 border-indigo-500 shadow-xl'
                            : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                        } ${isAdmin ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                      >
                        {/* 1. EDF Number & Category */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isAdmin && (
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                            )}
                            <button
                              onClick={() => onViewEdf(edf)}
                              className="font-mono font-black text-xs text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer truncate"
                              title="Click to view details"
                            >
                              {edf.edfNumber}
                            </button>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${getCategoryBadgeClass(edf.category)}`}>
                              {edf.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                            {/* Overdue or Status Pill */}
                            {isOverdue && col.key !== 'Received' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-red-50 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-900 animate-pulse-subtle">
                                Overdue
                              </span>
                            )}

                            {/* Partially Received indicator */}
                            {(() => {
                              const rawItems = edf.items || [];
                              const totalCount = edf.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
                              const receivedCount = edf.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;
                              const isPartial = receivedCount > 0 && receivedCount < totalCount;

                              if (isPartial || edf.status === 'Partially Received') {
                                return (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide bg-sky-100 text-sky-800 dark:bg-sky-950/90 dark:text-sky-300 border border-sky-300 dark:border-sky-800 shadow-2xs">
                                    {receivedCount}/{totalCount} Recv
                                  </span>
                                );
                              }
                              if (col.key === 'Received') {
                                return (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    {totalCount}/{totalCount} Recv
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>

                        {/* 2. Remarks & Notes */}
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mb-2 p-1.5 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 line-clamp-2">
                          <span className="font-bold text-slate-400 text-[10px] block mb-0.5">2. Notes:</span>
                          {edf.remarks ? (
                            <span>{edf.remarks}</span>
                          ) : (
                            <span className="italic text-slate-400">No remarks provided</span>
                          )}
                        </div>

                        {/* 3. Material Summary */}
                        <div className="mb-2.5">
                          <span className="font-bold text-slate-400 text-[10px] block mb-0.5">3. Materials:</span>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                            {edf.materialList}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-medium">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              Qty: {edf.quantity} {edf.unit}
                            </span>
                            {edf.items && edf.items.length > 1 && (
                              <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500">
                                +{edf.items.length - 1} more items
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 4. Live Timer */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 mb-2.5">
                          <span className="text-[10px] text-slate-400 font-bold">4. Live Timer:</span>
                          <TimerBadge requiredDate={edf.requiredDate} status={edf.status} compact />
                        </div>

                        {/* 5. Remaining EDF Information (Requester, Issue Date) */}
                        <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1.5 truncate max-w-[150px]">
                              <User className="w-3 h-3 text-slate-400" />
                              <strong className="text-slate-700 dark:text-slate-300 truncate">
                                {edf.requesterName}
                              </strong>
                            </span>

                            <span className="text-[10px] text-slate-400">
                              {new Date(edf.issueDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Quick Action Footer */}
                        <div className="flex items-center justify-between gap-1 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                          {/* View details */}
                          <button
                            onClick={() => onViewEdf(edf)}
                            className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="View Record Details"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </button>

                          {/* Fast Stage Transition Buttons: Received is available to BOTH Admin and Viewer */}
                          <div className="flex items-center gap-1">
                            {isUpdating ? (
                              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                {/* Mark Received is available to both Admin and Viewer */}
                                {(col.key === 'Pending' || col.key === 'Partially Received') && (
                                  <button
                                    onClick={() => handleQuickStatus(edf.id, 'Received')}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-900/60 transition-colors cursor-pointer"
                                    title="Mark all items as Received"
                                  >
                                    <PackageCheck className="w-3 h-3" />
                                    <span>Mark Received</span>
                                  </button>
                                )}

                                {isAdmin && col.key === 'Received' && (
                                  <button
                                    onClick={() => handleQuickStatus(edf.id, 'Pending')}
                                    className="flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                                    title="Reopen demand form as Pending"
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                    <span>Reopen Pending</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
