import React, { useState, useEffect } from 'react';
import { EDF, EDFStatusHistory } from '../types.ts';
import { TimerBadge } from './TimerBadge.tsx';
import { isEdfHighPriority } from './EDFList.tsx';
import { getCategoryBadgeClass } from '../utils/categoryColors.ts';
import {
  X,
  Calendar,
  User,
  Tag,
  PackageCheck,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  AlertTriangle,
  Edit,
  History,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface EDFDetailsModalProps {
  edf: EDF | null;
  onClose: () => void;
  onEdit?: (edf: EDF) => void;
  onMarkStatus?: (id: number, status: 'Received' | 'Completed' | 'Pending') => void;
  isAdmin: boolean;
}

export const EDFDetailsModal: React.FC<EDFDetailsModalProps> = ({
  edf,
  onClose,
  onEdit,
  onMarkStatus,
  isAdmin,
}) => {
  // Unconditionally call hooks at the top level
  const [history, setHistory] = useState<EDFStatusHistory[]>(edf?.statusHistory || []);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (!edf?.id) {
      setHistory([]);
      return;
    }

    if (edf.statusHistory && edf.statusHistory.length > 0) {
      setHistory(edf.statusHistory);
    }

    let isMounted = true;
    setIsLoadingHistory(true);

    fetch(`/api/edfs/${edf.id}/history`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('edf_auth_token')}`,
      },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EDFStatusHistory[]) => {
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          setHistory(data);
        } else if (edf.statusHistory && edf.statusHistory.length > 0) {
          setHistory(edf.statusHistory);
        } else {
          setHistory([
            {
              id: 0,
              edfId: edf.id,
              edfNumber: edf.edfNumber,
              fromStatus: null,
              toStatus: 'Pending',
              changedBy: edf.createdBy || 'System',
              notes: 'Initial demand form creation',
              createdAt: edf.createdAt || new Date().toISOString(),
            },
          ]);
        }
      })
      .catch((err) => {
        console.error('Failed to load status history:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [edf?.id, edf?.status]);

  if (!edf) return null;

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Received':
        return 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'Overdue':
        return 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'Pending':
      default:
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  };

  const getStatusIcon = (status: string, isInitial: boolean) => {
    if (isInitial) {
      return {
        icon: Sparkles,
        bg: 'bg-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-950/60',
        text: 'text-white',
      };
    }
    switch (status) {
      case 'Completed':
        return {
          icon: CheckCircle2,
          bg: 'bg-emerald-600 ring-4 ring-emerald-50 dark:ring-emerald-950/60',
          text: 'text-white',
        };
      case 'Received':
        return {
          icon: PackageCheck,
          bg: 'bg-indigo-600 ring-4 ring-indigo-50 dark:ring-indigo-950/60',
          text: 'text-white',
        };
      case 'Overdue':
        return {
          icon: AlertTriangle,
          bg: 'bg-red-600 ring-4 ring-red-50 dark:ring-red-950/60',
          text: 'text-white',
        };
      case 'Pending':
      default:
        return {
          icon: Clock,
          bg: 'bg-amber-500 ring-4 ring-amber-50 dark:ring-amber-950/60',
          text: 'text-white',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {edf.edfNumber}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoryBadgeClass(edf.category)}`}>
                  {edf.category}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Employee Demand Form Official Record
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold"
              title="Print Record"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Status & Live Countdown Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/20 border border-indigo-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400">
                Live Status & Schedule
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Status: {edf.isOverdue ? 'Overdue' : edf.status}
                </span>
                {isEdfHighPriority(edf.requiredDate, edf.status) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 shadow-2xs animate-pulse">
                    <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 fill-red-500/20 shrink-0" />
                    <span>High Priority (&lt;24h)</span>
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-1">
                Required Date Countdown
              </span>
              <TimerBadge requiredDate={edf.requiredDate} status={edf.status} />
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-semibold text-slate-400">Requester</span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                {edf.requesterName}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400">Category</span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                {edf.category}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400">Priority Level</span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    (edf.priority || 'Medium') === 'High'
                      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                      : (edf.priority || 'Medium') === 'Low'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                  }`}
                >
                  {(edf.priority || 'Medium') === 'High' && (
                    <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                  )}
                  <span>{edf.priority || 'Medium'}</span>
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400">Issue Date</span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                {new Date(edf.issueDate).toLocaleDateString()}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400">Required Date</span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                {new Date(edf.requiredDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Materials Table - Order: Material -> Unit -> Quantity */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Demand Form Material List
            </h4>
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-[10px]">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Material / Item Description</th>
                    <th className="py-2.5 px-4 w-28 text-right">Unit</th>
                    <th className="py-2.5 px-4 w-28 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {edf.items && edf.items.length > 0 ? (
                    edf.items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 text-center text-slate-400 font-mono">
                          {i + 1}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {item.itemDescription}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-right text-slate-500">
                          {item.unit}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-right text-slate-900 dark:text-white">
                          {item.quantity}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono">1</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {edf.materialList}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-right text-slate-500">
                        {edf.unit}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-right text-slate-900 dark:text-white">
                        {edf.quantity}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks */}
          {edf.remarks && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Remarks & Notes
              </h4>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                {edf.remarks}
              </div>
            </div>
          )}

          {/* Activity Timeline Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Activity Timeline
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Status change history and lifecycle events
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {history.length} Event{history.length !== 1 ? 's' : ''}
              </span>
            </div>

            {isLoadingHistory ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading status history...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="py-4 text-center rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-400">No status change events recorded yet.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {history.map((event, idx) => {
                  const isInitial = !event.fromStatus;
                  const iconConfig = getStatusIcon(event.toStatus, isInitial);
                  const Icon = iconConfig.icon;
                  const dateObj = new Date(event.createdAt);
                  const formattedDate = dateObj.toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const formattedTime = dateObj.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={event.id || idx} className="relative group">
                      {/* Timeline icon node */}
                      <div
                        className={`absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-xs transition-transform group-hover:scale-110 ${iconConfig.bg}`}
                      >
                        <Icon className={`w-3 h-3 ${iconConfig.text}`} />
                      </div>

                      {/* Timeline card content */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {event.fromStatus ? (
                              <>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeClass(
                                    event.fromStatus
                                  )}`}
                                >
                                  {event.fromStatus}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeClass(
                                    event.toStatus
                                  )}`}
                                >
                                  {event.toStatus}
                                </span>
                              </>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeClass(
                                  event.toStatus
                                )}`}
                              >
                                Initial Status: {event.toStatus}
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] font-semibold text-slate-400">
                            {formattedDate} • {formattedTime}
                          </span>
                        </div>

                        {event.notes && (
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {event.notes}
                          </p>
                        )}

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1.5">
                          <span className="text-slate-400">Changed by:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {event.changedBy || 'System'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Bar (Allow both Admin and Viewer to mark as Received) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            {isAdmin && (
              <button
                onClick={() => {
                  onClose();
                  if (onEdit) onEdit(edf);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {/* Mark as Received - available to both Admin and Viewer */}
              {edf.status !== 'Received' && edf.status !== 'Completed' && (
                <button
                  onClick={() => {
                    if (onMarkStatus) onMarkStatus(edf.id, 'Received');
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  title="Mark as Received (Stops live timer)"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Mark as Received</span>
                </button>
              )}

              {isAdmin && edf.status !== 'Completed' && (
                <button
                  onClick={() => {
                    if (onMarkStatus) onMarkStatus(edf.id, 'Completed');
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Completed</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
