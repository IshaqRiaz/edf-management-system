import React from 'react';
import { useLiveTimer } from '../utils/timer.ts';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface CompactLiveTimerProps {
  requiredDate: string | Date;
  status?: string;
  className?: string;
  showIcon?: boolean;
}

export const CompactLiveTimer: React.FC<CompactLiveTimerProps> = ({
  requiredDate,
  status,
  className = '',
  showIcon = false,
}) => {
  const timer = useLiveTimer(requiredDate, status);

  // If already received, timer is stopped
  if (status === 'Received') {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-center leading-tight shrink-0 select-none ${className}`}
        title="All items received - Delivery timer stopped"
      >
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Fulfilled
        </span>
        <span className="text-[9px] font-semibold text-blue-500/80">
          Timer Stopped
        </span>
      </div>
    );
  }

  // Days string
  const daysText = timer.isOverdue
    ? `Overdue: ${timer.days} ${timer.days === 1 ? 'Day' : 'Days'}`
    : `${timer.days} ${timer.days === 1 ? 'Day' : 'Days'}`;

  // Hours and minutes string
  const hoursMinText = `${String(timer.hours).padStart(2, '0')} Hours ${String(timer.minutes).padStart(2, '0')} Min`;

  // Color classes
  let colorClasses = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/80';
  if (timer.isOverdue) {
    colorClasses = 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800/80 animate-pulse';
  } else if (timer.color === 'orange' || timer.isTodayOrTomorrow) {
    colorClasses = 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/80';
  }

  return (
    <div
      className={`inline-flex flex-col items-center justify-center px-2.5 py-1 rounded-xl border text-center whitespace-nowrap shrink-0 shadow-2xs leading-tight select-none transition-colors ${colorClasses} ${className}`}
      title={timer.formattedText}
    >
      <div className="font-extrabold text-[11px] flex items-center justify-center gap-1">
        {showIcon && (
          timer.isOverdue ? (
            <AlertTriangle className="w-3 h-3 shrink-0 text-red-500" />
          ) : (
            <Clock className="w-3 h-3 shrink-0 opacity-80" />
          )
        )}
        <span>{daysText}</span>
      </div>
      <div className="text-[10px] font-bold opacity-90 tracking-tight">
        {hoursMinText}
      </div>
    </div>
  );
};
