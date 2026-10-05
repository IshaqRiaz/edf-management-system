import React from 'react';
import {
  Clock,
  Package,
  PackageCheck,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export interface StatusLegendProps {
  pendingCount: number;
  partiallyReceivedCount: number;
  receivedCount: number;
  totalCount: number;
  onSelectStatus: (status: 'Pending' | 'Partially Received' | 'Received') => void;
  activeStatusFilter?: string;
}

export const StatusLegend: React.FC<StatusLegendProps> = ({
  pendingCount,
  partiallyReceivedCount,
  receivedCount,
  totalCount,
  onSelectStatus,
  activeStatusFilter,
}) => {
  const safeTotal = Math.max(totalCount, 1);

  const stages = [
    {
      id: 'Pending' as const,
      stageNumber: '01',
      stageLabel: 'Stage 1',
      title: 'Pending',
      rule: '0 Items Received',
      definition: '0 of N items checked in (0%)',
      description:
        'Initial demand form state. No materials have been received at the facility yet. Live countdown timer is active.',
      count: pendingCount,
      percent: Math.round((pendingCount / safeTotal) * 100),
      icon: Clock,
      themeColor: 'amber',
      cardBg: 'bg-white dark:bg-slate-900',
      badgeBg:
        'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      iconBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/80',
      borderStyle:
        'border-amber-200/80 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-amber-500/10',
      accentText: 'text-amber-600 dark:text-amber-400',
      example: 'e.g. 0/8 items received',
      timerBehavior: 'Active live countdown',
    },
    {
      id: 'Partially Received' as const,
      stageNumber: '02',
      stageLabel: 'Stage 2',
      title: 'Partially Received',
      rule: '1 to N-1 Items Received',
      definition: 'At least 1 item received, but not all',
      description:
        'In-progress warehouse intake. Some materials are received and verified while remaining items are still awaited.',
      count: partiallyReceivedCount,
      percent: Math.round((partiallyReceivedCount / safeTotal) * 100),
      icon: Package,
      themeColor: 'sky',
      cardBg: 'bg-white dark:bg-slate-900',
      badgeBg:
        'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-300 dark:border-sky-800',
      iconBg: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/80',
      borderStyle:
        'border-sky-200/80 dark:border-sky-900/40 hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-sky-500/10',
      accentText: 'text-sky-600 dark:text-sky-400',
      example: 'e.g. 4/8 items received',
      timerBehavior: 'Active until all arrive',
    },
    {
      id: 'Received' as const,
      stageNumber: '03',
      stageLabel: 'Stage 3',
      title: 'Received',
      rule: 'All (N/N) Items Received',
      definition: 'All items received & verified (100%)',
      description:
        'Demand fulfilled and completed. Every item in the request has arrived. The countdown timer stops automatically.',
      count: receivedCount,
      percent: Math.round((receivedCount / safeTotal) * 100),
      icon: PackageCheck,
      themeColor: 'emerald',
      cardBg: 'bg-white dark:bg-slate-900',
      badgeBg:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80',
      borderStyle:
        'border-emerald-200/80 dark:border-emerald-900/40 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-emerald-500/10',
      accentText: 'text-emerald-600 dark:text-emerald-400',
      example: 'e.g. 8/8 items received',
      timerBehavior: 'Timer stopped & completed',
    },
  ];

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 w-full min-w-0 transition-all">
      {/* Legend Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>EDF Status Lifecycle & Interactive Legend</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Item-Level Source of Truth
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Demands transition automatically as individual items are checked in. <strong>Click any stage</strong> to filter the EDF list.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
          <Info className="w-3.5 h-3.5 text-indigo-500" />
          <span>Click cards to filter</span>
        </div>
      </div>

      {/* 3 Clickable Lifecycle Stage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 lg:gap-4 relative">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          const isSelected = activeStatusFilter?.toLowerCase() === st.id.toLowerCase();

          return (
            <button
              key={st.id}
              type="button"
              onClick={() => onSelectStatus(st.id)}
              className={`group relative p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
                st.cardBg
              } ${st.borderStyle} ${
                isSelected
                  ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-indigo-500/10'
                  : ''
              }`}
            >
              <div>
                {/* Top Bar: Stage & Icon */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400">
                      {st.stageNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide border ${st.badgeBg}`}>
                      {st.rule}
                    </span>
                  </div>

                  <div className={`p-2 rounded-xl border ${st.iconBg} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                {/* Status Name & Count */}
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {st.title}
                  </h4>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl sm:text-2xl font-black font-mono ${st.accentText}`}>
                      {st.count}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      ({st.percent}%)
                    </span>
                  </div>
                </div>

                {/* Definition & Detail */}
                <div className="space-y-1.5 mt-2">
                  <div className="flex items-start gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${st.accentText}`} />
                    <span>{st.definition}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {st.description}
                  </p>
                </div>
              </div>

              {/* Bottom Metadata & Action CTA */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <div className="flex flex-col text-[10px]">
                  <span className="text-slate-400 font-medium">{st.example}</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{st.timerBehavior}</span>
                </div>

                <div className={`flex items-center gap-1 font-bold ${st.accentText} group-hover:translate-x-1 transition-transform`}>
                  <span>Filter</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Progression Arrow Bar Guide (Desktop) */}
      <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-300">
            Automated Lifecycle Flow:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            Pending (0/N Items)
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
            Partially Received (1 to N-1 Items)
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            Received (All N/N Items)
          </span>
        </div>
      </div>
    </div>
  );
};
