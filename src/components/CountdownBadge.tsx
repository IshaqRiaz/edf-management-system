import React, { useState, useEffect } from 'react';
import { EDFStatus } from '../types/index.ts';
import { calculateRemainingTime, RemainingTimeInfo } from '../utils/dateUtils.ts';
import { AlertCircle, Clock, CheckCircle2, Hourglass } from 'lucide-react';

interface CountdownBadgeProps {
  requiredDate: string;
  status: EDFStatus;
  receivedDate?: string | null;
  completedDate?: string | null;
  compact?: boolean;
  showSeconds?: boolean;
}

export const CountdownBadge: React.FC<CountdownBadgeProps> = ({
  requiredDate,
  status,
  receivedDate,
  completedDate,
  compact = false,
}) => {
  const [timeInfo, setTimeInfo] = useState<RemainingTimeInfo>(() =>
    calculateRemainingTime(requiredDate, status, receivedDate, completedDate)
  );

  useEffect(() => {
    // If finished, no need to tick continuously
    if (status === 'Received' || status === 'Completed') {
      setTimeInfo(calculateRemainingTime(requiredDate, status, receivedDate, completedDate));
      return;
    }

    // Live continuous second-by-second reduction
    const interval = setInterval(() => {
      setTimeInfo(calculateRemainingTime(requiredDate, status, receivedDate, completedDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [requiredDate, status, receivedDate, completedDate]);

  // When Completed or Received -> Timer Stopped
  if (timeInfo.isCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-600/30">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{compact ? timeInfo.shortText : timeInfo.formattedText}</span>
      </span>
    );
  }

  // 1. RED Phase: When required date has passed / OVERDUE
  if (timeInfo.timerPhase === 'red' || timeInfo.isOverdue) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 ring-2 ring-rose-500/50 shadow-sm animate-pulse ${
          compact ? '' : 'tracking-wide'
        }`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 animate-bounce" />
        <span className="font-mono">
          {compact ? timeInfo.shortText : timeInfo.formattedText}
        </span>
      </span>
    );
  }

  // 2. ORANGE Phase: 1 day before and on the required date (<= 24 hours remaining)
  if (timeInfo.timerPhase === 'orange') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 ring-2 ring-amber-500/40 shadow-xs animate-pulse`}
      >
        <Hourglass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 animate-spin-slow" />
        <span className="font-mono">
          {compact ? timeInfo.shortText : timeInfo.formattedText}
        </span>
        <span className="text-[10px] font-black uppercase bg-amber-200/80 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-1.5 py-0.2 rounded-sm ml-0.5">
          Due Soon
        </span>
      </span>
    );
  }

  // 3. GREEN Phase: Starting date and time (plenty of time remaining, > 24 hours)
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-600/30 shadow-xs`}
    >
      <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span className="font-mono font-bold">
        {compact ? timeInfo.shortText : timeInfo.formattedText}
      </span>
      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hidden sm:inline">
        On Schedule
      </span>
    </span>
  );
};
