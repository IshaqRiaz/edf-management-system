import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  PackageCheck,
  CheckCircle2,
  Plus,
  FileSpreadsheet,
  Calendar,
  AlertTriangle,
  FileText,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import { EDF, EDFStatus } from '../types/index.ts';
import { CountdownBadge } from '../components/CountdownBadge.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { CategoryBadge } from '../components/CategoryBadge.tsx';
import { exportEdfsToExcel, exportEdfsToCsv } from '../utils/excelUtils.ts';
import { downloadEdfPdf } from '../utils/pdfGenerator.ts';

interface EdfListProps {
  edfs: EDF[];
  categories: string[];
  initialCategory?: string;
  initialStatus?: string;
  onSelectEdf: (edf: EDF) => void;
  onOpenCreate: () => void;
  onOpenImport: () => void;
  onMarkReceived: (id: number) => void;
  onMarkCompleted: (id: number) => void;
  onDeleteEdf: (id: number) => void;
  onBulkUpdateStatus?: (ids: number[], status: EDFStatus) => Promise<void>;
  onBulkDelete?: (ids: number[]) => Promise<void>;
}

export const EdfList: React.FC<EdfListProps> = ({
  edfs,
  categories,
  initialCategory = 'All',
  initialStatus = 'All',
  onSelectEdf,
  onOpenCreate,
  onOpenImport,
  onMarkReceived,
  onMarkCompleted,
  onDeleteEdf,
  onBulkUpdateStatus,
  onBulkDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [sortField, setSortField] = useState<'requiredDate' | 'requestDate' | 'edfNumber'>('requiredDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Bulk row selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const filteredEdfs = useMemo(() => {
    return edfs.filter((item) => {
      // Category filter
      if (selectedCategory !== 'All' && item.categoryName !== selectedCategory) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'All' && item.status !== selectedStatus) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const inNum = item.edfNumber?.toLowerCase().includes(q);
        const inCat = item.categoryName?.toLowerCase().includes(q);
        const inTeam = item.requestingTeam?.toLowerCase().includes(q);
        const inDesc = item.requestDescription?.toLowerCase().includes(q);
        const inRemarks = item.remarks?.toLowerCase().includes(q);
        const inMats = item.materials?.some((m) => m.materialName?.toLowerCase().includes(q));
        if (!inNum && !inCat && !inTeam && !inDesc && !inRemarks && !inMats) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'requiredDate') {
        const aT = new Date(a.requiredDate).getTime();
        const bT = new Date(b.requiredDate).getTime();
        return sortOrder === 'asc' ? aT - bT : bT - aT;
      }
      if (sortField === 'requestDate') {
        const aT = new Date(a.requestDate).getTime();
        const bT = new Date(b.requestDate).getTime();
        return sortOrder === 'asc' ? aT - bT : bT - aT;
      }
      return sortOrder === 'asc'
        ? a.edfNumber.localeCompare(b.edfNumber)
        : b.edfNumber.localeCompare(a.edfNumber);
    });
  }, [edfs, selectedCategory, selectedStatus, searchTerm, sortField, sortOrder]);

  const handleExportExcel = () => {
    exportEdfsToExcel(filteredEdfs, `EDF_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCsv = () => {
    exportEdfsToCsv(filteredEdfs, `EDF_Records_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Selection helpers
  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = useMemo(() => {
    if (filteredEdfs.length === 0) return false;
    return filteredEdfs.every((e) => selectedIds.has(e.id));
  }, [filteredEdfs, selectedIds]);

  const isSomeSelected = useMemo(() => {
    if (isAllSelected || filteredEdfs.length === 0) return false;
    return filteredEdfs.some((e) => selectedIds.has(e.id));
  }, [filteredEdfs, selectedIds, isAllSelected]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredEdfs.forEach((e) => next.delete(e.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredEdfs.forEach((e) => next.add(e.id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedCount = selectedIds.size;
  const selectedEdfs = useMemo(() => {
    return edfs.filter((e) => selectedIds.has(e.id));
  }, [edfs, selectedIds]);

  const handleBulkStatus = async (status: EDFStatus) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    try {
      if (onBulkUpdateStatus) {
        await onBulkUpdateStatus(ids, status);
      } else {
        for (const id of ids) {
          if (status === 'Received') onMarkReceived(id);
          else if (status === 'Completed') onMarkCompleted(id);
        }
      }
      clearSelection();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDeleteAction = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    try {
      if (onBulkDelete) {
        await onBulkDelete(ids);
      } else {
        if (window.confirm(`Are you sure you want to delete ${ids.length} selected records?`)) {
          for (const id of ids) {
            onDeleteEdf(id);
          }
        }
      }
      clearSelection();
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleExportSelectedCsv = () => {
    if (selectedEdfs.length === 0) return;
    exportEdfsToCsv(selectedEdfs, `Selected_EDF_Records_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportSelectedExcel = () => {
    if (selectedEdfs.length === 0) return;
    exportEdfsToExcel(selectedEdfs, `Selected_EDF_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            EDF Requisition Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Full registry of Employee Demand Forms and technical material items
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleExportCsv}
            title="Download request history as CSV spreadsheet"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-rose-500" />
            <span>Export to CSV</span>
          </button>
          <button
            onClick={handleExportExcel}
            title="Download request history as Excel (.xlsx)"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export to Excel</span>
          </button>
          <button
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/30 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New EDF</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by EDF #, material item, team name, specification, or remarks..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
              <option value="Received">Received</option>
              <option value="Completed">Completed</option>
              <option value="Submitted">Submitted</option>
              <option value="Draft">Draft</option>
            </select>

            {/* Sort order toggle */}
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              {sortOrder === 'asc' ? 'Earliest Due' : 'Latest Due'}
            </button>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-400 mr-1 text-[11px] font-semibold uppercase">Category Filter:</span>
          {['All', 'HVAC / AC', 'Plumbing', 'Generator', 'Telephone', 'Electrical', 'General / Other'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inline Bulk Selection Status Banner */}
      {selectedCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-50 via-orange-50 to-rose-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-rose-200 dark:border-rose-900/60 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-tr from-[#FF5A5F] to-[#FF8E53] text-white text-xs font-black shadow-xs">
              {selectedCount}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {selectedCount} of {filteredEdfs.length} requisitions selected
              </span>
              {selectedCount < filteredEdfs.length && (
                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-semibold text-[#FF5A5F] hover:underline cursor-pointer ml-1"
                >
                  Select all {filteredEdfs.length} visible
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBulkStatus('Received')}
              disabled={isBulkProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
              title="Mark all selected as Received"
            >
              {isBulkProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
              <span>Mark as Received</span>
            </button>

            <button
              onClick={() => handleBulkStatus('Completed')}
              disabled={isBulkProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
              title="Mark all selected as Completed"
            >
              {isBulkProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Mark as Completed</span>
            </button>

            <button
              onClick={clearSelection}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white px-2 py-1 font-medium cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Records Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                {/* Select All Checkbox Header */}
                <th className="py-3 px-3 w-10 text-center">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={toggleSelectAll}
                      title={isAllSelected ? 'Deselect all rows' : 'Select all visible rows'}
                      aria-label="Select all visible EDF rows"
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-[#FF5A5F] focus:ring-[#FF5A5F] cursor-pointer accent-[#FF5A5F]"
                    />
                  </div>
                </th>
                <th className="py-3 px-3.5">EDF Number</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5">Material Summary & Items</th>
                <th className="py-3 px-3.5">Requesting Team</th>
                <th className="py-3 px-3.5">Request Date</th>
                <th className="py-3 px-3.5">Required Date</th>
                <th className="py-3 px-3.5">Live Timer / Overdue</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEdfs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-sm">
                    No EDF records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredEdfs.map((edf) => {
                  const totalItems = edf.materialCount || (edf.materials ? edf.materials.length : 0);
                  const isOverdue = edf.status === 'Overdue';
                  const isSelected = selectedIds.has(edf.id);

                  return (
                    <tr
                      key={edf.id}
                      onClick={() => onSelectEdf(edf)}
                      className={`cursor-pointer transition-all card-hover ${
                        isSelected
                          ? 'bg-rose-50/90 dark:bg-rose-950/60 border-l-4 border-[#FF5A5F] ring-1 ring-rose-300 dark:ring-rose-800'
                          : isOverdue
                          ? 'bg-rose-100/75 dark:bg-rose-950/50 border-l-4 border-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-950 dark:text-rose-100'
                          : 'hover:bg-rose-50/40 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Checkbox column */}
                      <td
                        className="py-3.5 px-3 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(edf.id)}
                            aria-label={`Select EDF ${edf.edfNumber}`}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-[#FF5A5F] focus:ring-[#FF5A5F] cursor-pointer accent-[#FF5A5F]"
                          />
                        </div>
                      </td>

                      {/* EDF Number */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {isOverdue && (
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                          )}
                          <span>{edf.edfNumber}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Priority: <span className={edf.priority === 'Urgent' ? 'text-rose-600 font-bold' : ''}>{edf.priority}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <CategoryBadge category={edf.categoryName} size="sm" />
                      </td>

                      {/* Material Summary */}
                      <td className="py-3.5 px-3.5 max-w-[240px]">
                        <div className="font-medium text-slate-900 dark:text-slate-200 truncate">
                          {edf.requestDescription || (edf.materials && edf.materials[0]?.materialName) || 'Technical Materials'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {edf.materials && edf.materials.length > 0 ? (
                            <span>
                              {edf.materials.map((m) => `${m.materialName} (${m.quantity} ${m.unit})`).join(', ')}
                            </span>
                          ) : (
                            <span className="italic text-slate-400">No items listed</span>
                          )}
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                            {totalItems} {totalItems === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </td>

                      {/* Requesting Team */}
                      <td className="py-3.5 px-3.5 text-slate-700 dark:text-slate-300 max-w-[130px] truncate">
                        {edf.requestingTeam}
                      </td>

                      {/* Request Date */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {new Date(edf.requestDate).toLocaleDateString()}
                      </td>

                      {/* Required Date */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(edf.requiredDate).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(edf.requiredDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Live Timer / Overdue */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <CountdownBadge
                          requiredDate={edf.requiredDate}
                          status={edf.status}
                          receivedDate={edf.receivedDate}
                          completedDate={edf.completedDate}
                        />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <StatusBadge status={edf.status} size="sm" />
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Mark Received */}
                          {edf.status !== 'Received' && edf.status !== 'Completed' && (
                            <button
                              onClick={() => onMarkReceived(edf.id)}
                              title="Mark Material as Received"
                              className="p-1.5 rounded-lg text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/60 transition-colors"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </button>
                          )}

                          {/* Quick Mark Completed */}
                          {edf.status === 'Received' && (
                            <button
                              onClick={() => onMarkCompleted(edf.id)}
                              title="Mark Requisition Completed"
                              className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* View details */}
                          <button
                            onClick={() => onSelectEdf(edf)}
                            title="View Full Requisition Details"
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Download PDF voucher */}
                          <button
                            onClick={() => downloadEdfPdf(edf)}
                            title="Download PDF Requisition Document"
                            className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/50 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => onDeleteEdf(edf.id)}
                            title="Delete EDF"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer record count */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredEdfs.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{edfs.length}</strong> total records
          </span>
          <span className="text-[11px]">
            Live Required Date countdown calculated from system clock
          </span>
        </div>
      </div>

      {/* Floating Bottom Bulk Action Dock */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-200">
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 text-white shadow-2xl border border-rose-500/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 ring-1 ring-black/10">
            {/* Left: Selected count & text */}
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FF5A5F] to-[#FF8E53] text-white text-xs font-black shadow-xs">
                {selectedCount}
              </span>
              <div>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {selectedCount} {selectedCount === 1 ? 'EDF Row' : 'EDF Rows'} Selected
                </span>
                <span className="hidden md:inline text-[11px] text-slate-400 ml-2">
                  Apply batch operations or export
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkStatus('Received')}
                disabled={isBulkProcessing}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                title="Mark all selected EDFs as Received"
              >
                {isBulkProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
                <span>Mark Received</span>
              </button>

              <button
                onClick={() => handleBulkStatus('Completed')}
                disabled={isBulkProcessing}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                title="Mark all selected EDFs as Completed"
              >
                {isBulkProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Mark Completed</span>
              </button>

              <button
                onClick={handleExportSelectedCsv}
                disabled={isBulkProcessing}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                title="Export selected EDFs as CSV"
              >
                <Download className="w-3.5 h-3.5 text-rose-400" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleExportSelectedExcel}
                disabled={isBulkProcessing}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                title="Export selected EDFs as Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={handleBulkDeleteAction}
                disabled={isBulkProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 transition-all cursor-pointer disabled:opacity-50"
                title="Delete selected EDFs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>

              <button
                onClick={clearSelection}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear Selection"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
