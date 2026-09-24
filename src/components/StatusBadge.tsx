import React from 'react';
import { EDFStatus } from '../types/index.ts';
import { AlertTriangle, CheckCircle2, Clock, PackageCheck, Send, FileEdit } from 'lucide-react';

interface StatusBadgeProps {
  status: EDFStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 font-medium gap-1',
    md: 'text-xs px-2.5 py-1 font-semibold gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 font-bold gap-2',
  }[size];

  switch (status) {
    case 'Overdue':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-600/30 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-500/40 shadow-xs animate-pulse ${sizeClasses}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>OVERDUE</span>
        </span>
      );

    case 'Completed':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/30 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-500/40 shadow-xs ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Completed</span>
        </span>
      );

    case 'Received':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-600/30 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-500/40 shadow-xs ${sizeClasses}`}
        >
          <PackageCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>Received</span>
        </span>
      );

    case 'Partially Received':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/30 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-500/40 shadow-xs ${sizeClasses}`}
        >
          <PackageCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Partially Received</span>
        </span>
      );

    case 'Pending':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-600/30 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-500/40 shadow-xs ${sizeClasses}`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Pending</span>
        </span>
      );

    case 'Submitted':
      return (
        <span
          className={`inline-flex items-center rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-600/30 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-500/40 shadow-xs ${sizeClasses}`}
        >
          <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>Submitted</span>
        </span>
      );

    case 'Draft':
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-600/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 ${sizeClasses}`}
        >
          <FileEdit className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Draft</span>
        </span>
      );
  }
};
