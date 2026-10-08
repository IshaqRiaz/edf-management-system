import React, { useState, useEffect } from 'react';
import { EDF, EDFItem, EDFStatusHistory } from '../types.ts';
import { TimerBadge } from './TimerBadge.tsx';
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
  Undo2,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
  HelpCircle,
  Loader2,
} from 'lucide-react';

interface EDFDetailsModalProps {
  edf: EDF | null;
  onClose: () => void;
  onEdit?: (edf: EDF) => void;
  onMarkStatus?: (id: number, status: 'Received' | 'Partially Received' | 'Pending') => void;
  onReceiveItems?: (edfId: number, itemIds: number[]) => Promise<void>;
  onUndoItemReceived?: (edfId: number, itemId: number) => Promise<void>;
  isAdmin: boolean;
}

export const EDFDetailsModal: React.FC<EDFDetailsModalProps> = ({
  edf,
  onClose,
  onEdit,
  onMarkStatus,
  onReceiveItems,
  onUndoItemReceived,
  isAdmin,
}) => {
  const [history, setHistory] = useState<EDFStatusHistory[]>(edf?.statusHistory || []);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Item-level partial receiving states
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [isReceivingItems, setIsReceivingItems] = useState(false);
  const [undoItemConfirm, setUndoItemConfirm] = useState<EDFItem | null>(null);
  const [isUndoingItem, setIsUndoingItem] = useState(false);

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

  // Material items list
  const rawItems: EDFItem[] =
    edf.items && edf.items.length > 0
      ? edf.items
      : [
          {
            id: 0,
            edfId: edf.id,
            itemDescription: edf.materialList,
            quantity: edf.quantity,
            unit: edf.unit,
            status: edf.status === 'Received' ? 'Received' : 'Pending',
          },
        ];

  const totalItemsCount = rawItems.length;
  const receivedItemsCount = rawItems.filter((i) => i.status === 'Received').length;
  const pendingItems = rawItems.filter((i) => i.status !== 'Received');
  const allReceived = totalItemsCount > 0 && receivedItemsCount === totalItemsCount;
  const isPartiallyReceived = receivedItemsCount > 0 && receivedItemsCount < totalItemsCount;

  // Status text according to Requirement 4
  const getStatusDisplayLabel = () => {
    if (allReceived || edf.status === 'Received') {
      return `Received — ${totalItemsCount} of ${totalItemsCount} items received`;
    }
    if (isPartiallyReceived || edf.status === 'Partially Received') {
      return `Partially Received — ${receivedItemsCount} of ${totalItemsCount} items received`;
    }
    return `Pending — 0 of ${totalItemsCount} received`;
  };

  // Toggle selection for a single pending item
  const handleToggleItemSelect = (itemId?: number) => {
    if (!itemId) return;
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // Select all or deselect all pending items
  const handleToggleSelectAll = () => {
    const selectablePendingIds = pendingItems.map((i) => i.id!).filter(Boolean);
    if (selectedItemIds.length === selectablePendingIds.length && selectablePendingIds.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(selectablePendingIds);
    }
  };

  // Submit selected items as Received
  const handleMarkSelectedAsReceived = async () => {
    if (selectedItemIds.length === 0 || !onReceiveItems) return;
    setIsReceivingItems(true);
    try {
      await onReceiveItems(edf.id, selectedItemIds);
      setSelectedItemIds([]);
    } catch (err) {
      console.error('Error marking items received:', err);
    } finally {
      setIsReceivingItems(false);
    }
  };

  // Undo receiving for a single item with confirmation
  const handleConfirmUndo = async () => {
    if (!undoItemConfirm?.id || !onUndoItemReceived) return;
    setIsUndoingItem(true);
    try {
      await onUndoItemReceived(edf.id, undoItemConfirm.id);
      setUndoItemConfirm(null);
    } catch (err) {
      console.error('Error undoing item receiving:', err);
    } finally {
      setIsUndoingItem(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Received':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Partially Received':
        return 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
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
      case 'Received':
        return {
          icon: CheckCircle2,
          bg: 'bg-emerald-600 ring-4 ring-emerald-50 dark:ring-emerald-950/60',
          text: 'text-white',
        };
      case 'Partially Received':
        return {
          icon: PackageCheck,
          bg: 'bg-sky-600 ring-4 ring-sky-50 dark:ring-sky-950/60',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 font-bold shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {edf.edfNumber}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoryBadgeClass(edf.category)}`}>
                  {edf.category}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(edf.status)}`}>
                  {edf.status}
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
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              title="Print Record"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* 1. EDF Number & Status Header */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400">1. EDF Number:</span>
              <span className="font-mono font-black text-sm text-slate-900 dark:text-white">{edf.edfNumber}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryBadgeClass(edf.category)}`}>
                {edf.category}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(edf.status)}`}>
                {edf.status}
              </span>
            </div>
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
              {getStatusDisplayLabel()}
            </span>
          </div>

          {/* 2. Remarks & Notes */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block mb-1">
              2. Remarks & Notes:
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {edf.remarks ? edf.remarks : <span className="italic text-slate-400">No installation or delivery notes provided.</span>}
            </p>
          </div>

          {/* 3. Material Summary */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-1">
                3. Material Summary:
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {edf.materialList}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-1">
                <span>Total Quantity: <strong className="text-slate-800 dark:text-slate-200 font-bold">{edf.quantity} {edf.unit}</strong></span>
                <span>•</span>
                <span>Rows: <strong className="text-slate-800 dark:text-slate-200 font-bold">{totalItemsCount}</strong></span>
              </div>
            </div>

            {/* Receiving Progress Bar */}
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Material Receiving Progress
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                  {receivedItemsCount} / {totalItemsCount} Items Received ({totalItemsCount > 0 ? Math.round((receivedItemsCount / totalItemsCount) * 100) : 0}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-500 ${
                    allReceived
                      ? 'bg-emerald-500'
                      : isPartiallyReceived
                      ? 'bg-sky-500'
                      : 'bg-amber-400'
                  }`}
                  style={{
                    width: `${totalItemsCount > 0 ? (receivedItemsCount / totalItemsCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 4. Live Timer Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/20 border border-indigo-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                4. Live Countdown Timer:
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Active tracking toward required delivery date
              </span>
            </div>
            <div>
              <TimerBadge requiredDate={edf.requiredDate} status={edf.status} compact />
            </div>
          </div>

          {/* 5. Remaining EDF Information (Requester, Category, Dates) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800">
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

          {/* ITEM-LEVEL RECEIVING SYSTEM (Requirement 1, 2, 3, 8, 9, 10) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Material Items & Receiving Checklist</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {receivedItemsCount} of {totalItemsCount} Received
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Check individual items as they arrive. Both Admin and Viewer can mark items received.
                </p>
              </div>

              {/* Mark Selected Button */}
              {pendingItems.length > 0 && onReceiveItems && (
                <button
                  type="button"
                  onClick={handleMarkSelectedAsReceived}
                  disabled={selectedItemIds.length === 0 || isReceivingItems}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
                >
                  {isReceivingItems ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Receiving...</span>
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-4 h-4" />
                      <span>
                        Mark Selected Items as Received
                        {selectedItemIds.length > 0 && ` (${selectedItemIds.length})`}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Checklist Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-[11px]">
                      {/* Checkbox column */}
                      <th className="py-2.5 px-3.5 w-12 text-center">
                        {pendingItems.length > 0 ? (
                          <input
                            type="checkbox"
                            aria-label="Select all pending items"
                            checked={
                              pendingItems.length > 0 &&
                              selectedItemIds.length === pendingItems.map((i) => i.id!).filter(Boolean).length
                            }
                            onChange={handleToggleSelectAll}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 accent-blue-600 cursor-pointer"
                            title="Select all pending items"
                          />
                        ) : (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        )}
                      </th>
                      <th className="py-2.5 px-3.5">Material</th>
                      <th className="py-2.5 px-3.5 w-24 text-right">Unit</th>
                      <th className="py-2.5 px-3.5 w-24 text-right">Quantity</th>
                      <th className="py-2.5 px-3.5 w-28 text-center">Status</th>
                      <th className="py-2.5 px-3.5 min-w-[180px]">Receiving Info & Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rawItems.map((item, i) => {
                      const isReceived = item.status === 'Received';
                      const isChecked = Boolean(item.id && selectedItemIds.includes(item.id));

                      return (
                        <tr
                          key={item.id || i}
                          className={`transition-colors ${
                            isReceived
                              ? 'bg-emerald-50/30 dark:bg-emerald-950/20 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                              : isChecked
                              ? 'bg-blue-50/40 dark:bg-blue-950/25 hover:bg-blue-50/60'
                              : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3.5 text-center">
                            {isReceived ? (
                              <div
                                className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-2xs"
                                title="Received"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            ) : item.id ? (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleItemSelect(item.id)}
                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 accent-blue-600 cursor-pointer"
                                aria-label={`Select ${item.itemDescription}`}
                              />
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 font-mono text-[10px]">
                                {i + 1}
                              </span>
                            )}
                          </td>

                          {/* Material Description */}
                          <td className="py-2.5 px-3.5 font-medium text-slate-800 dark:text-slate-200">
                            <span className={isReceived ? 'font-semibold text-slate-900 dark:text-white' : ''}>
                              {item.itemDescription}
                            </span>
                          </td>

                          {/* Unit */}
                          <td className="py-2.5 px-3.5 font-medium text-right text-slate-500">
                            {item.unit}
                          </td>

                          {/* Quantity */}
                          <td className="py-2.5 px-3.5 font-mono font-bold text-right text-slate-900 dark:text-white">
                            {item.quantity}
                          </td>

                          {/* Item Status */}
                          <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                            {isReceived ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <Check className="w-3 h-3" />
                                <span>Received</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* Receiving Info & Controlled Undo Option */}
                          <td className="py-2.5 px-3.5 text-[11px]">
                            {isReceived ? (
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="text-slate-500 dark:text-slate-400">
                                  <span>
                                    {item.receivedAt
                                      ? new Date(item.receivedAt).toLocaleDateString([], {
                                          month: 'short',
                                          day: 'numeric',
                                        }) +
                                        ' ' +
                                        new Date(item.receivedAt).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : 'Recorded'}
                                  </span>
                                  {item.receivedBy && (
                                    <span className="text-slate-400 block text-[10px]">
                                      by {item.receivedBy}
                                    </span>
                                  )}
                                </div>

                                {item.id && onUndoItemReceived && (
                                  <button
                                    type="button"
                                    onClick={() => setUndoItemConfirm(item)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:text-rose-800 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[10px] font-bold transition-colors cursor-pointer border border-rose-200 dark:border-rose-900"
                                    title="Undo receiving with confirmation"
                                  >
                                    <Undo2 className="w-3 h-3" />
                                    <span>Undo Received</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                Awaiting arrival
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Helper */}
              {pendingItems.length > 0 && (
                <div className="p-3 bg-slate-50/70 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">
                    {selectedItemIds.length} of {pendingItems.length} pending items checked
                  </span>
                  {selectedItemIds.length > 0 && onReceiveItems && (
                    <button
                      type="button"
                      onClick={handleMarkSelectedAsReceived}
                      disabled={isReceivingItems}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>Submit {selectedItemIds.length} Received Item{selectedItemIds.length > 1 ? 's' : ''}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Activity Timeline Section (Includes history of item receiving & status transitions) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Activity & Receiving Timeline
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Audit log of status updates, item arrivals, and coordinator changes
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
                          <span className="text-slate-400">Recorded by:</span>
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
              {/* Mark All as Received - available to both Admin and Viewer */}
              {edf.status !== 'Received' && (
                <button
                  onClick={() => {
                    if (onMarkStatus) onMarkStatus(edf.id, 'Received');
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  title="Mark entire EDF as Received (Stops live timer)"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Mark All as Received</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRMATION DIALOG FOR "UNDO RECEIVED" (Requirement 10) */}
      {undoItemConfirm && (
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
                    &quot;{undoItemConfirm.itemDescription}&quot;
                  </strong>{' '}
                  as <strong>Pending</strong> again?
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  This will safely recalculate the EDF&apos;s delivery status without removing any past receiving history.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isUndoingItem}
                onClick={() => setUndoItemConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isUndoingItem}
                onClick={handleConfirmUndo}
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
