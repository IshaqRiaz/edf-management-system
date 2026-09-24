import React, { useState, useMemo } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  PackageCheck,
  CheckCircle2,
  Calendar,
  Download,
  Filter,
  Eye,
  FileSpreadsheet,
  Clock,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import { EDF } from '../types/index.ts';
import { CountdownBadge } from '../components/CountdownBadge.tsx';
import { CategoryBadge } from '../components/CategoryBadge.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { exportEdfsToExcel } from '../utils/excelUtils.ts';

interface OverduePageProps {
  overdueEdfs: EDF[];
  categories: string[];
  onSelectEdf: (edf: EDF) => void;
  onMarkReceived: (id: number) => void;
  onMarkCompleted: (id: number) => void;
}

export const OverduePage: React.FC<OverduePageProps> = ({
  overdueEdfs,
  categories,
  onSelectEdf,
  onMarkReceived,
  onMarkCompleted,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return overdueEdfs.filter((edf) => {
      if (selectedCategory !== 'All' && edf.categoryName !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inNum = edf.edfNumber?.toLowerCase().includes(q);
        const inTeam = edf.requestingTeam?.toLowerCase().includes(q);
        const inDesc = edf.requestDescription?.toLowerCase().includes(q);
        const inMat = edf.materials?.some((m) => m.materialName?.toLowerCase().includes(q));
        if (!inNum && !inTeam && !inDesc && !inMat) return false;
      }
      return true;
    });
  }, [overdueEdfs, selectedCategory, searchQuery]);

  const handleExportOverdue = () => {
    exportEdfsToExcel(filtered, `Overdue_EDFs_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Alert Header Box */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white shadow-lg border border-rose-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30 animate-pulse">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                Overdue Material Requisitions Tracker
              </h1>
              <p className="text-xs sm:text-sm text-rose-200 mt-1">
                Showing all EDFs whose Required Date has elapsed without material receipt.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2 rounded-xl bg-rose-900/60 border border-rose-700/60 text-center">
              <span className="text-[10px] uppercase font-bold text-rose-300 block">
                Total Overdue
              </span>
              <span className="text-2xl font-black font-mono text-white">
                {overdueEdfs.length}
              </span>
            </div>

            <button
              onClick={handleExportOverdue}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white text-rose-950 hover:bg-rose-50 shadow-sm transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-rose-700" />
              <span>Export Overdue List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search overdue EDF #, material, or team..."
            className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Department:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overdue Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-rose-200 dark:border-rose-900/60 shadow-md overflow-hidden">
        <div className="p-4 bg-rose-50/70 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
            <span className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
              Elapsed Time Overdue Counter (Continuous Tick)
            </span>
          </div>
          <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
            {filtered.length} Overdue Demand Forms
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3.5">EDF Number</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5">Materials & Items</th>
                <th className="py-3 px-3.5">Requesting Team</th>
                <th className="py-3 px-3.5">Required Date</th>
                <th className="py-3 px-3.5">Overdue Duration (Days / Hours / Mins)</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5 text-right">Receipt Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100 dark:divide-rose-950/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    {overdueEdfs.length === 0
                      ? 'Great news! There are currently no overdue material requests.'
                      : 'No overdue requests match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filtered.map((edf) => (
                  <tr
                    key={edf.id}
                    onClick={() => onSelectEdf(edf)}
                    className="hover:bg-rose-50/60 dark:hover:bg-rose-950/30 bg-rose-50/20 dark:bg-rose-950/10 cursor-pointer transition-colors"
                  >
                    {/* EDF Number */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap font-mono font-bold text-rose-600 dark:text-rose-400">
                      {edf.edfNumber}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <CategoryBadge category={edf.categoryName} size="sm" />
                    </td>

                    {/* Materials */}
                    <td className="py-3.5 px-3.5 max-w-[240px]">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {edf.requestDescription || (edf.materials && edf.materials[0]?.materialName) || 'Materials'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {edf.materials && edf.materials.length > 0 ? (
                          <span>
                            {edf.materials.map((m) => `${m.materialName} (${m.quantity} ${m.unit})`).join(', ')}
                          </span>
                        ) : (
                          'No item details'
                        )}
                      </div>
                    </td>

                    {/* Team */}
                    <td className="py-3.5 px-3.5 text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                      {edf.requestingTeam}
                    </td>

                    {/* Required Date */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {new Date(edf.requiredDate).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(edf.requiredDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Overdue live counter */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <CountdownBadge
                        requiredDate={edf.requiredDate}
                        status={edf.status}
                        receivedDate={edf.receivedDate}
                      />
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <StatusBadge status={edf.status} size="sm" />
                    </td>

                    {/* Mark Received */}
                    <td
                      className="py-3.5 px-3.5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onMarkReceived(edf.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-colors"
                        title="Mark material as received to stop overdue timer"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Mark Received</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
