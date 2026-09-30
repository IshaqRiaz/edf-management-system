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
        className={`inline-flex items-center gap-1 font-bold rounded-lg border transition-all ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
        } bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 shadow-2xs whitespace-nowrap`}
        title="Demand Received - Countdown stopped"
      >
        {showIcon && <PackageCheck className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-blue-600 dark:text-blue-400 shrink-0`} />}
        <span className="tracking-tight">Received (Timer Stopped)</span>
      </span>
    );
  }

  if (status === 'Completed') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-bold rounded-lg border transition-all ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
        } bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80 shadow-2xs whitespace-nowrap`}
        title="Demand Completed - Fulfilled"
      >
        {showIcon && <CheckCircle2 className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-emerald-600 dark:text-emerald-400 shrink-0`} />}
        <span className="tracking-tight">Completed</span>
      </span>
    );
  }

  if (timer.color === 'red') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-bold rounded-lg border transition-all ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
        } bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800 animate-pulse whitespace-nowrap`}
        title={`Deadline: ${new Date(requiredDate).toLocaleDateString()}`}
      >
        {showIcon && <AlertCircle className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-rose-600 dark:text-rose-400 shrink-0 animate-bounce`} />}
        <span className="font-mono tracking-tight">{timer.formattedText}</span>
      </span>
    );
  }

  if (timer.color === 'orange') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded-lg border transition-all ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
        } bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap`}
        title={`Deadline: ${new Date(requiredDate).toLocaleDateString()}`}
      >
        {showIcon && <AlertTriangle className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-600 dark:text-amber-400 shrink-0`} />}
        <span className="font-mono tracking-tight">{timer.formattedText}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-lg border transition-all ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 whitespace-nowrap`}
      title={`Deadline: ${new Date(requiredDate).toLocaleDateString()}`}
    >
      {showIcon && <Clock className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-emerald-600 dark:text-emerald-400 shrink-0`} />}
      <span className="font-mono tracking-tight">{timer.formattedText}</span>
    </span>
  );
};
