import React, { useState } from 'react';
import {
  X,
  AlertOctagon,
  AlertTriangle,
  Clock,
  Calendar,
  PackageCheck,
  CheckCircle2,
  FileText,
  Download,
  Search,
  ArrowRight,
  ExternalLink,
  Hourglass,
} from 'lucide-react';
import { EDF } from '../types/index.ts';
import { CountdownBadge } from './CountdownBadge.tsx';
import { CategoryBadge } from './CategoryBadge.tsx';
import { StatusBadge } from './StatusBadge.tsx';
import { exportEdfsToExcel } from '../utils/excelUtils.ts';
import { downloadEdfPdf } from '../utils/pdfGenerator.ts';

interface OverdueDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  overdueEdfs: EDF[];
  onSelectEdf: (edf: EDF) => void;
  onMarkReceived: (id: number) => void;
}

export const OverdueDetailsModal: React.FC<OverdueDetailsModalProps> = ({
  isOpen,
  onClose,
  overdueEdfs,
  onSelectEdf,
  onMarkReceived,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All');

  if (!isOpen) return null;

  const filtered = overdueEdfs.filter((edf) => {
    if (selectedDomain !== 'All' && edf.categoryName !== selectedDomain) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const inNum = edf.edfNumber?.toLowerCase().includes(q);
      const inTeam = edf.requestingTeam?.toLowerCase().includes(q);
      const inDesc = edf.requestDescription?.toLowerCase().includes(q);
      const inMat = edf.materials?.some((m) => m.materialName?.toLowerCase().includes(q));
      if (!inNum && !inTeam && !inDesc && !inMat) return false;
    }
    return true;
  });

  const domains = Array.from(new Set(overdueEdfs.map((e) => e.categoryName)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl my-auto rounded-3xl bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-900/80 shadow-2xl shadow-rose-950/20 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar in vibrant Grapefruit / Rose */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-rose-600 via-rose-700 to-[#FF5A5F] text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
              <AlertOctagon className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  Overdue Requisitions Inspection Bar
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white text-rose-700 shadow-sm animate-pulse">
                  {overdueEdfs.length} OVERDUE
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-0.5">
                Comprehensive details of all EDFs past required date without material receipt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportEdfsToExcel(overdueEdfs, 'Overdue_EDF_Requisitions.xlsx')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Filter / Search Sub-header */}
        <div className="p-4 bg-rose-50/70 dark:bg-rose-950/20 border-b border-rose-200 dark:border-rose-900/40 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by EDF #, material, or team..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Filter Domain:</span>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="All">All Domains ({overdueEdfs.length})</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Overdue Items List with full details */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              No overdue EDFs matching your search.
            </div>
          ) : (
            filtered.map((edf) => (
              <div
                key={edf.id}
                className="p-5 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/60 shadow-xs hover:border-rose-400 dark:hover:border-rose-700 transition-all card-hover"
              >
                {/* Top Row: EDF Number, Category, Live Overdue Timer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-200/60 dark:border-rose-900/40">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base font-black text-rose-600 dark:text-rose-400">
                      {edf.edfNumber}
                    </span>
                    <CategoryBadge category={edf.categoryName} size="sm" />
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                      OVERDUE
                    </span>
                  </div>

                  {/* Additional Live Timer in Bold Red */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                      Elapsed Timer:
                    </span>
                    <CountdownBadge
                      requiredDate={edf.requiredDate}
                      status={edf.status}
                      receivedDate={edf.receivedDate}
                    />
                  </div>
                </div>

                {/* Scope & Description */}
                <div className="mt-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {edf.requestDescription || 'Material Demand Requisition'}
                  </h3>
                  {edf.remarks && (
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 italic">
                      Remarks: {edf.remarks}
                    </p>
                  )}
                </div>

                {/* Requisition Meta Details Grid */}
                <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-rose-100 dark:border-rose-900/30">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Issue / Request Date
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {new Date(edf.requestDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-rose-100/60 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800">
                    <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase block">
                      Required Date (Crossed)
                    </span>
                    <span className="font-bold text-rose-800 dark:text-rose-100 mt-0.5 block">
                      {new Date(edf.requiredDate).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-rose-100 dark:border-rose-900/30">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Requesting Team
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                      {edf.requestingTeam}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-rose-100 dark:border-rose-900/30">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Priority Level
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 mt-0.5 block">
                      {edf.priority.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Requisitioned Materials Items Box */}
                <div className="mt-3.5 p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    <span>Requisitioned Material Items ({edf.materials?.length || 0})</span>
                    <span className="text-rose-600">Pending Store Arrival</span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {edf.materials && edf.materials.length > 0 ? (
                      edf.materials.map((mat, idx) => (
                        <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 text-center font-mono text-[11px] text-slate-400">
                              {idx + 1}.
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {mat.materialName}
                            </span>
                            {mat.description && (
                              <span className="text-[11px] text-slate-400">
                                ({mat.description})
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700">
                            {mat.quantity} {mat.unit}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">No items listed</span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions for Overdue item */}
                <div className="mt-4 flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onMarkReceived(edf.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-sm hover:scale-105 active:scale-95 transition-all"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>Mark Material Received (Stops Timer)</span>
                    </button>
                    <button
                      onClick={() => downloadEdfPdf(edf)}
                      className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                      title="Download PDF"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onSelectEdf(edf);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    <span>Full Requisition File</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Showing <strong className="text-rose-600">{filtered.length}</strong> overdue requisitions
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
