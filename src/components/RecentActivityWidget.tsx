import React, { useState } from 'react';
import {
  Activity,
  PlusCircle,
  CheckCircle2,
  Edit3,
  Trash2,
  Layers,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  PackageCheck,
} from 'lucide-react';
import { ActivityItem, EDF } from '../types/index.ts';

interface RecentActivityWidgetProps {
  activities: ActivityItem[];
  onSelectEdfById?: (edfId: number) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({
  activities,
  onSelectEdfById,
  onRefresh,
  isRefreshing = false,
}) => {
  const [showCount, setShowCount] = useState<5 | 10>(5);

  const displayedActivities = activities.slice(0, showCount);

  // Helper for human-readable relative time
  const formatTimeAgo = (dateStr?: string | null) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Helper for operation-specific styling and icons
  const getActionBadge = (action: string, status?: string | null) => {
    switch (action) {
      case 'created':
        return {
          icon: PlusCircle,
          color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800',
          dot: 'bg-sky-500',
          label: 'Created',
        };
      case 'status_changed':
        if (status === 'Received') {
          return {
            icon: PackageCheck,
            color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800',
            dot: 'bg-teal-500',
            label: 'Received',
          };
        }
        if (status === 'Completed') {
          return {
            icon: CheckCircle2,
            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
            dot: 'bg-emerald-500',
            label: 'Completed',
          };
        }
        return {
          icon: Clock,
          color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500',
          label: status || 'Status Updated',
        };
      case 'bulk_status_changed':
        return {
          icon: Layers,
          color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
          dot: 'bg-indigo-500',
          label: 'Bulk Status',
        };
      case 'updated':
        return {
          icon: Edit3,
          color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/60 border-violet-200 dark:border-violet-800',
          dot: 'bg-violet-500',
          label: 'Updated',
        };
      case 'deleted':
      case 'bulk_deleted':
        return {
          icon: Trash2,
          color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
          dot: 'bg-rose-500',
          label: 'Deleted',
        };
      default:
        return {
          icon: Activity,
          color: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
          dot: 'bg-slate-500',
          label: 'Action',
        };
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF5A5F]/20 to-[#FF7A59]/20 text-[#FF5A5F] flex items-center justify-center shrink-0 border border-[#FF5A5F]/30">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Recent Activity
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/50 text-[#FF5A5F] border border-[#FF5A5F]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A5F] animate-ping" />
                Audit Trail
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chronological log of recent operations for compliance and accountability
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
            <button
              onClick={() => setShowCount(5)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                showCount === 5
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 5
            </button>
            <button
              onClick={() => setShowCount(10)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                showCount === 10
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 10
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50"
              title="Refresh audit activity"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FF5A5F]' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Activity List */}
      {displayedActivities.length === 0 ? (
        <div className="py-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
          <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
            No recent activity recorded yet
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Operations like creating EDFs or marking them as Received will automatically record here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {displayedActivities.map((act, index) => {
            const badge = getActionBadge(act.action, act.status);
            const Icon = badge.icon;
            const isClickable = !!(act.edfId && onSelectEdfById);

            return (
              <div
                key={act.id || index}
                onClick={() => {
                  if (isClickable && act.edfId) {
                    onSelectEdfById(act.edfId);
                  }
                }}
                className={`py-3.5 px-3 rounded-2xl transition-all flex items-start sm:items-center justify-between gap-3 group ${
                  isClickable
                    ? 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                    : ''
                }`}
              >
                {/* Left: Icon & Details */}
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${badge.color} transition-transform group-hover:scale-105`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
                        {act.title}
                      </span>
                      {act.status && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {act.status}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {act.description && (
                        <span className="truncate max-w-[280px] sm:max-w-md">
                          {act.description}
                        </span>
                      )}
                      {act.description && <span className="opacity-40">•</span>}
                      <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                        <User className="w-3 h-3 text-slate-400" />
                        {act.user || 'Office Coordinator'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Timestamp and Arrow */}
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                  <div className="text-right">
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500"
                      title={act.createdAt ? new Date(act.createdAt).toLocaleString() : undefined}
                    >
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(act.createdAt)}
                    </span>
                  </div>

                  {isClickable && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 group-hover:text-[#FF5A5F]">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Audit Summary */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Tamper-evident operational audit trail
        </span>
        <span className="font-semibold text-slate-400">
          Showing {displayedActivities.length} of {activities.length} logged events
        </span>
      </div>
    </div>
  );
};
