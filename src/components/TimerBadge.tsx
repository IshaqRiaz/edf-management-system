import React from 'react';
import { useLiveTimer } from '../utils/timer.ts';
import { Clock, AlertTriangle, AlertCircle, CheckCircle2, PackageCheck } from 'lucide-react';

interface TimerBadgeProps {
  requiredDate: string | Date;
  compact?: boolean;
  showIcon?: boolean;
  status?: string;
}

export const TimerBadge: React.FC<TimerBadgeProps> = ({
  requiredDate,
  compact = false,
  showIcon = true,
  status,
}) => {
  // Always call hooks unconditionally at the top level
  const timer = useLiveTimer(requiredDate, status);

  // If status is Received or Completed, timer is stopped!
  if (status === 'Received') {
    return (
      <span
        className="inline-flex items-center gap-1 font-bold rounded-xl border px-2 py-1 text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 shadow-2xs whitespace-nowrap shrink-0"
        title="Demand Received - Countdown stopped"
      >
        {showIcon && <PackageCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
        <span className="tracking-tight">{compact ? 'Received' : 'Received (Timer Stopped)'}</span>
      </span>
    );
  }

  if (status === 'Completed') {
    return (
      <span
        className="inline-flex items-center gap-1 font-bold rounded-xl border px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80 shadow-2xs whitespace-nowrap shrink-0"
        title="Demand Completed - Fulfilled"
      >
        {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
        <span className="tracking-tight">Completed</span>
      </span>
    );
  }

  // OVERDUE TIMER (Requirement 2: Compact 2-line box with Days on top, Hours & Min on bottom)
  if (timer.isOverdue || timer.color === 'red') {
    const daysLabel = `${timer.days} ${timer.days === 1 ? 'Day' : 'Days'}`;
    const hoursMinutesLabel = `${String(timer.hours).padStart(2, '0')} Hours ${String(timer.minutes).padStart(2, '0')} Min`;

    return (
      <div
        className="inline-flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 shadow-2xs text-center select-none shrink-0"
        title={`Overdue: ${daysLabel}, ${hoursMinutesLabel} (Deadline: ${new Date(requiredDate).toLocaleDateString()})`}
      >
        <div className="flex items-center gap-1 font-black text-[11px] leading-tight text-rose-600 dark:text-rose-400">
          {showIcon && <AlertCircle className="w-3 h-3 shrink-0 text-rose-500 animate-pulse" />}
          <span className="font-mono tracking-tight font-extrabold">{daysLabel}</span>
        </div>
        <div className="font-mono text-[10px] font-bold tracking-tight text-rose-700 dark:text-rose-300 leading-tight mt-0.5 whitespace-nowrap">
          {hoursMinutesLabel}
        </div>
      </div>
    );
  }

  // DUE SOON (Within 24 Hours)
  if (timer.color === 'orange') {
    const daysLabel = timer.days > 0 ? `${timer.days} ${timer.days === 1 ? 'Day' : 'Days'}` : 'Due Today';
    const hoursMinutesLabel = `${String(timer.hours).padStart(2, '0')} Hours ${String(timer.minutes).padStart(2, '0')} Min`;

    if (compact) {
      return (
        <div
          className="inline-flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 shadow-2xs text-center select-none shrink-0"
          title={`Remaining: ${daysLabel}, ${hoursMinutesLabel} (Deadline: ${new Date(requiredDate).toLocaleDateString()})`}
        >
          <div className="flex items-center gap-1 font-black text-[11px] leading-tight text-amber-700 dark:text-amber-400">
            {showIcon && <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />}
            <span className="font-mono tracking-tight font-extrabold">{daysLabel}</span>
          </div>
          <div className="font-mono text-[10px] font-bold tracking-tight text-amber-800 dark:text-amber-300 leading-tight mt-0.5 whitespace-nowrap">
            {hoursMinutesLabel}
          </div>
        </div>
      );
    }

    return (
      <span
        className="inline-flex items-center gap-1 font-medium rounded-lg border px-2 py-0.5 text-xs bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap shrink-0"
        title={`Deadline: ${new Date(requiredDate).toLocaleDateString()}`}
      >
        {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
        <span className="font-mono tracking-tight">{timer.formattedText}</span>
      </span>
    );
  }

  // ACTIVE COUNTDOWN (Normal Future Deadline)
  if (compact) {
    const daysLabel = `${timer.days} ${timer.days === 1 ? 'Day' : 'Days'}`;
    const hoursMinutesLabel = `${String(timer.hours).padStart(2, '0')} Hours ${String(timer.minutes).padStart(2, '0')} Min`;

    return (
      <div
        className="inline-flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 shadow-2xs text-center select-none shrink-0"
        title={`Remaining: ${daysLabel}, ${hoursMinutesLabel} (Deadline: ${new Date(requiredDate).toLocaleDateString()})`}
      >
        <div className="flex items-center gap-1 font-black text-[11px] leading-tight text-emerald-700 dark:text-emerald-400">
          {showIcon && <Clock className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />}
          <span className="font-mono tracking-tight font-extrabold">{daysLabel}</span>
        </div>
        <div className="font-mono text-[10px] font-bold tracking-tight text-emerald-700 dark:text-emerald-300 leading-tight mt-0.5 whitespace-nowrap">
          {hoursMinutesLabel}
        </div>
      </div>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 font-medium rounded-lg border px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 whitespace-nowrap shrink-0"
      title={`Deadline: ${new Date(requiredDate).toLocaleDateString()}`}
    >
      {showIcon && <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
      <span className="font-mono tracking-tight">{timer.formattedText}</span>
    </span>
  );
};
