import React from 'react';
import { useLiveTimer } from '../utils/timer.ts';
import { Clock, AlertTriangle, AlertCircle, PackageCheck } from 'lucide-react';

interface TimerBadgeProps {
  requiredDate: string | Date;
  compact?: boolean;
  showIcon?: boolean;
  status?: string;
  className?: string;
}

export const TimerBadge: React.FC<TimerBadgeProps> = ({
  requiredDate,
  showIcon = true,
  status,
  className = '',
}) => {
  const timer = useLiveTimer(requiredDate, status);

  // If status is Received, timer is stopped!
  if (status === 'Received') {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-center leading-none shrink-0 shadow-2xs select-none min-w-[76px] ${className}`}
        title="All items received - Delivery timer stopped"
      >
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 leading-tight">
          Received
        </span>
        <span className="text-[9px] font-semibold text-emerald-600/80 whitespace-nowrap leading-tight mt-0.5">
          Timer Stopped
        </span>
      </div>
    );
  }

  // Days string on top line
  const daysLabel = timer.isOverdue
    ? `Overdue: ${timer.days} ${timer.days === 1 ? 'Day' : 'Days'}`
    : `${timer.days} ${timer.days === 1 ? 'Day' : 'Days'}`;

  // Hours and Minutes on bottom line
  const hoursMinutesLabel = `${timer.hours} Hours ${timer.minutes} Min`;

  // OVERDUE TIMER (Red)
  if (timer.isOverdue || timer.color === 'red') {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 shadow-2xs text-center select-none shrink-0 min-w-[84px] max-w-[124px] animate-pulse ${className}`}
        title={`Overdue: ${daysLabel}, ${hoursMinutesLabel} (Deadline: ${new Date(requiredDate).toLocaleDateString()})`}
      >
        <div className="flex items-center gap-1 font-black text-[10.5px] leading-tight text-rose-600 dark:text-rose-400">
          {showIcon && <AlertCircle className="w-2.5 h-2.5 shrink-0 text-rose-500" />}
          <span className="font-mono tracking-tight font-extrabold whitespace-nowrap">{daysLabel}</span>
        </div>
        <div className="font-mono text-[9.5px] font-bold tracking-tight text-rose-700 dark:text-rose-300 leading-tight mt-0.5 whitespace-nowrap">
          {hoursMinutesLabel}
        </div>
      </div>
    );
  }

  // DUE SOON (Within 24 Hours - Orange/Amber)
  if (timer.color === 'orange' || timer.isTodayOrTomorrow) {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 shadow-2xs text-center select-none shrink-0 min-w-[84px] max-w-[124px] ${className}`}
        title={`Remaining: ${daysLabel}, ${hoursMinutesLabel} (Deadline: ${new Date(requiredDate).toLocaleDateString()})`}
      >
        <div className="flex items-center gap-1 font-black text-[10.5px] leading-tight text-amber-700 dark:text-amber-400">
          {showIcon && <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-600 dark:text-amber-400" />}
          <span className="font-mono tracking-tight font-extrabold whitespace-nowrap">{daysLabel}</span>
        </div>
        <div className="font-mono text-[9.5px] font-bold tracking-tight text-amber-800 dark:text-amber-300 leading-tight mt-0.5 whitespace-nowrap">
          {hoursMinutesLabel}
        </div>
      </div>
    );
  }

  // NORMAL COUNTDOWN (Green/Emerald)
  return (
    <div
      className={`inline-flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 shadow-2xs text-center select-none shrink-0 min-w-[84px] max-w-[124px] ${className}`}
      title={`Remaining: ${daysLabel}, ${hoursMinutesLabel} (Deadline: ${new Date(requiredDate).toLocaleDateString()})`}
    >
      <div className="flex items-center gap-1 font-black text-[10.5px] leading-tight text-emerald-700 dark:text-emerald-400">
        {showIcon && <Clock className="w-2.5 h-2.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
        <span className="font-mono tracking-tight font-extrabold whitespace-nowrap">{daysLabel}</span>
      </div>
      <div className="font-mono text-[9.5px] font-bold tracking-tight text-emerald-700 dark:text-emerald-300 leading-tight mt-0.5 whitespace-nowrap">
        {hoursMinutesLabel}
      </div>
    </div>
  );
};
