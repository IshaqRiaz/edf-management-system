import React from 'react';
import { EDF } from '../types';
import { CheckCircle2, PackageCheck, Clock } from 'lucide-react';

export interface ReceivingProgressBarProps {
  item: EDF;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
  /** Optional custom container width/classes */
  className?: string;
  /** Whether to show the text label/count */
  showLabel?: boolean;
  /** Variant style */
  variant?: 'bar' | 'pill';
}

/**
 * Computes receipt count and percentage progress for an EDF
 */
export function getReceivingProgress(item: EDF) {
  const rawItems = item.items || [];
  const totalCount = item.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
  const rawReceived = item.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;

  const isStatusReceived = item.status === 'Received';
  const isStatusPartial = item.status === 'Partially Received';

  const isAllReceived = isStatusReceived || (totalCount > 0 && rawReceived >= totalCount);
  const isPartial = !isAllReceived && (rawReceived > 0 || isStatusPartial);
  const isPending = !isAllReceived && !isPartial;

  const receivedCount = isAllReceived && rawReceived === 0 ? totalCount : rawReceived;
  const percentage = isAllReceived
    ? 100
    : isPending
    ? 0
    : totalCount > 0
    ? Math.min(Math.max(Math.round((receivedCount / totalCount) * 100), 1), 99)
    : 0;

  return {
    totalCount,
    receivedCount,
    isAllReceived,
    isPartial,
    isPending,
    percentage,
  };
}

/**
 * Visual color-coded progress bar that dynamically transitions from:
 * - gray (Pending)
 * - indigo (Partially Received)
 * - emerald (Received)
 * based on item receipt counts.
 */
export const ReceivingProgressBar: React.FC<ReceivingProgressBarProps> = ({
  item,
  size = 'sm',
  className = '',
  showLabel = true,
  variant = 'bar',
}) => {
  const {
    totalCount,
    receivedCount,
    isAllReceived,
    isPartial,
    isPending,
    percentage,
  } = getReceivingProgress(item);

  // Dynamic styling based on receipt state
  let stateName = 'Pending';
  let trackClass = 'bg-slate-100 dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/80';
  let barClass = 'bg-slate-400 dark:bg-slate-500';
  let textClass = 'text-slate-500 dark:text-slate-400';
  let dotClass = 'bg-slate-400 dark:bg-slate-500';
  let pillBadgeClass = 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
  let Icon = Clock;

  if (isAllReceived) {
    stateName = 'Received';
    trackClass = 'bg-emerald-100/70 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/80';
    barClass = 'bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500 shadow-xs shadow-emerald-500/20';
    textClass = 'text-emerald-700 dark:text-emerald-300';
    dotClass = 'bg-emerald-500 dark:bg-emerald-400';
    pillBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    Icon = CheckCircle2;
  } else if (isPartial) {
    stateName = 'Partially Received';
    trackClass = 'bg-indigo-100/70 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/80';
    barClass = 'bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 shadow-xs shadow-indigo-500/20';
    textClass = 'text-indigo-700 dark:text-indigo-300';
    dotClass = 'bg-indigo-500 dark:bg-indigo-400';
    pillBadgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    Icon = PackageCheck;
  }

  const tooltipText = `Receipt Progress: ${receivedCount}/${totalCount} received (${percentage}%) — ${stateName}`;

  if (variant === 'pill') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs font-medium shadow-xs transition-colors duration-500 ${pillBadgeClass} ${className}`}
        title={tooltipText}
      >
        <span className="inline-flex items-center gap-1 font-bold whitespace-nowrap shrink-0">
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span>{stateName}</span>
        </span>
        <div
          className={`h-2 rounded-full overflow-hidden border shadow-inner transition-colors duration-500 ${trackClass} ${
            size === 'md' ? 'w-24 sm:w-28' : 'w-16 sm:w-20'
          }`}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${barClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="font-mono font-bold text-[11px] whitespace-nowrap shrink-0">
          {receivedCount}/{totalCount}
        </span>
      </div>
    );
  }

  // Default 'bar' variant: stacked with mini progress track and count
  const heightClass = size === 'xs' ? 'h-1.5' : size === 'md' ? 'h-2.5' : 'h-2';
  const widthClass = size === 'xs' ? 'w-20' : size === 'md' ? 'w-32 sm:w-36' : 'w-24 sm:w-28';

  return (
    <div
      className={`flex flex-col gap-1 items-stretch ${widthClass} ${className}`}
      title={tooltipText}
    >
      {showLabel && (
        <div className="flex items-center justify-between text-[10px] leading-tight px-0.5 select-none">
          <span className={`inline-flex items-center gap-1 font-bold transition-colors duration-500 ${textClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-500 ${dotClass}`} />
            <span className="truncate max-w-[65px] sm:max-w-none">
              {isAllReceived ? 'Received' : isPartial ? 'Partial' : 'Pending'}
            </span>
          </span>
          <span className="font-mono font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            {receivedCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Visual Color-coded Progress Bar Track */}
      <div
        className={`w-full ${heightClass} rounded-full overflow-hidden border shadow-inner transition-colors duration-500 ${trackClass}`}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Item receipt progress: ${receivedCount} of ${totalCount} items received (${percentage}%)`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
