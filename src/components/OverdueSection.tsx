import React from 'react';
import { EDF } from '../types.ts';
import { TimerBadge } from './TimerBadge.tsx';
import {
  AlertOctagon,
  Clock,
  PackageCheck,
  CheckCircle2,
  Eye,
  Edit,
  ArrowLeft,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';

interface OverdueSectionProps {
  edfs: EDF[];
  onBackToDashboard: () => void;
  onViewDetails: (edf: EDF) => void;
  onEdit: (edf: EDF) => void;
  onMarkStatus: (id: number, status: 'Received' | 'Completed' | 'Pending') => void;
  isAdmin: boolean;
}

export const OverdueSection: React.FC<OverdueSectionProps> = ({
  edfs,
  onBackToDashboard,
  onViewDetails,
  onEdit,
  onMarkStatus,
  isAdmin,
}) => {
  // Filter only overdue EDFs (Received and Completed are NOT overdue)
  const overdueEdfs = edfs.filter((item) => {
    if (item.status === 'Received' || item.status === 'Completed') return false;
    if (item.status === 'Overdue' || item.isOverdue) return true;
    const isPast = new Date(item.requiredDate).getTime() < Date.now();
    return isPast;
  });

  return (
    <div className="space-y-6">
      {/* Overdue Header Banner (Compact Modern Size) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 text-white shadow-xl shadow-red-500/20 border border-red-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur shrink-0 mt-0.5">
              <AlertOctagon className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-black tracking-wider mb-1">
                Urgent Attention
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                Overdue Employee Demand Forms
              </h2>
              <p className="text-rose-100 text-xs mt-0.5 max-w-xl">
                Demands that have passed their required date. Live timers show accumulated delay time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-1.5 rounded-xl bg-white text-rose-700 font-extrabold text-xs shadow-md text-center">
              <span className="text-lg font-black">{overdueEdfs.length}</span>
              <span className="block text-[10px] font-bold text-rose-600">
                Overdue Forms
              </span>
            </div>

            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table for Overdue Records */}
      <div className="rounded-3xl bg-white dark:bg-stone-900 border-2 border-rose-300 dark:border-rose-900 shadow-lg shadow-rose-500/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-rose-200 dark:border-rose-900 bg-rose-100/70 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 text-[11px] font-bold tracking-wider">
                <th className="py-3.5 px-4">EDF Number</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Requester</th>
                <th className="py-3.5 px-4">Issue Date</th>
                <th className="py-3.5 px-4">Required Date</th>
                <th className="py-3.5 px-4">Live Timer</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 min-w-[200px]">Material Summary</th>
                <th className="py-3.5 px-4 min-w-[180px]">Remarks</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100 dark:divide-rose-900/60 text-xs">
              {overdueEdfs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-stone-500 dark:text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                      <p className="text-base font-bold text-stone-800 dark:text-stone-200">
                        Zero Overdue EDFs!
                      </p>
                      <p className="text-xs text-stone-400 max-w-sm">
                        Great job! All employee demand forms are either fulfilled or within their deadline schedules.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                overdueEdfs.map((item) => {
                  const rawItems = item.items || [];
                  const totalCount = item.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
                  const receivedCount = item.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;
                  const isPartial = receivedCount > 0 && receivedCount < totalCount;

                  return (
                  <tr
                    key={item.id}
                    className="bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/70 dark:hover:bg-rose-900/50 transition-colors border-l-4 border-rose-500"
                  >
                    {/* EDF Number */}
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-950 dark:text-rose-100 whitespace-nowrap">
                      <button
                        onClick={() => onViewDetails(item)}
                        className="hover:underline hover:text-rose-600 flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{item.edfNumber}</span>
                      </button>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 border border-rose-200 dark:border-rose-800 shadow-xs">
                        {item.category}
                      </span>
                    </td>

                    {/* Requester */}
                    <td className="py-3.5 px-4 font-semibold text-stone-800 dark:text-stone-200 whitespace-nowrap">
                      {item.requesterName}
                    </td>

                    {/* Issue Date */}
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400 whitespace-nowrap font-medium">
                      {new Date(item.issueDate).toLocaleDateString()}
                    </td>

                    {/* Required Date */}
                    <td className="py-3.5 px-4 text-rose-900 dark:text-rose-200 font-bold whitespace-nowrap">
                      {new Date(item.requiredDate).toLocaleDateString()}
                    </td>

                    {/* Live Timer */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <TimerBadge requiredDate={item.requiredDate} status={item.status} />
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-sm shadow-rose-600/30">
                          <AlertOctagon className="w-3 h-3" />
                          <span>Overdue</span>
                        </span>
                        {isPartial && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300">
                            Partial: {receivedCount}/{totalCount}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Material Summary */}
                    <td className="py-3.5 px-4 text-stone-800 dark:text-stone-200 font-medium">
                      <span>{item.materialList}</span>
                      <span className="text-stone-500 font-mono text-[11px] ml-1.5">
                        ({item.quantity} {item.unit})
                      </span>
                    </td>

                    {/* Remarks */}
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400 italic">
                      {item.remarks || <span className="text-stone-400">None</span>}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewDetails(item)}
                          className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white bg-white/70 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-xs cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Mark Received (Available to both Admin and Viewer) */}
                        <button
                          onClick={() => onMarkStatus(item.id, 'Received')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                          title="Mark Demand Form as Received (Stops live timer)"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Received</span>
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              onClick={() => onEdit(item)}
                              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white bg-white/70 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-xs cursor-pointer"
                              title="Edit EDF"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => onMarkStatus(item.id, 'Completed')}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                              title="Mark Completed"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Completed</span>
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
      </div>
    </div>
  );
};
