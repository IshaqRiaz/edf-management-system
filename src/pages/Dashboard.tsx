import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Fan,
  Wrench,
  Zap,
  PhoneCall,
  Activity,
  Package,
  ArrowRight,
  TrendingUp,
  PackageCheck,
  UploadCloud,
  Plus,
  Flame,
  AlertOctagon,
  Sparkles,
  Layers,
  ThermometerSnowflake,
  Droplets,
  Cpu,
  Radio,
  Sliders,
} from 'lucide-react';
import { EDF, DashboardStats, ActivityItem } from '../types/index.ts';
import { CountdownBadge } from '../components/CountdownBadge.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { CategoryBadge } from '../components/CategoryBadge.tsx';
import { RecentActivityWidget } from '../components/RecentActivityWidget.tsx';

interface DashboardProps {
  stats: DashboardStats | null;
  recentEdfs: EDF[];
  overdueEdfs: EDF[];
  activities: ActivityItem[];
  onSelectEdf: (edf: EDF) => void;
  onNavigateToCategory: (categoryName: string) => void;
  onNavigateToOverdue: () => void;
  onNavigateToRecords: () => void;
  onOpenCreate: () => void;
  onOpenImport: () => void;
  onMarkReceived: (id: number) => void;
  onOpenOverdueDetails: () => void;
  onRefreshActivities?: () => void;
  isRefreshingActivities?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  recentEdfs,
  overdueEdfs,
  activities,
  onSelectEdf,
  onNavigateToCategory,
  onNavigateToOverdue,
  onNavigateToRecords,
  onOpenCreate,
  onOpenImport,
  onMarkReceived,
  onOpenOverdueDetails,
  onRefreshActivities,
  isRefreshingActivities,
}) => {
  // Domain Cards with Prominent Domain Icons & Grapefruit Accents
  const domainCards = [
    {
      name: 'HVAC / AC',
      label: 'HVAC & Cooling Systems',
      count: stats?.categoryCounts['HVAC / AC'] || 0,
      icon: Fan,
      secondaryIcon: ThermometerSnowflake,
      accentColor: '#06B6D4',
      badgeBg: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400',
      borderGlow: 'hover:border-cyan-400 dark:hover:border-cyan-500',
    },
    {
      name: 'Plumbing',
      label: 'Plumbing & Drainage',
      count: stats?.categoryCounts['Plumbing'] || 0,
      icon: Wrench,
      secondaryIcon: Droplets,
      accentColor: '#3B82F6',
      badgeBg: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400',
      borderGlow: 'hover:border-sky-400 dark:hover:border-sky-500',
    },
    {
      name: 'Generator',
      label: 'Power Plant & Diesel Gen',
      count: stats?.categoryCounts['Generator'] || 0,
      icon: Zap,
      secondaryIcon: Cpu,
      accentColor: '#F59E0B',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
      borderGlow: 'hover:border-amber-400 dark:hover:border-amber-500',
    },
    {
      name: 'Telephone',
      label: 'Telecom & PABX Lines',
      count: stats?.categoryCounts['Telephone'] || 0,
      icon: PhoneCall,
      secondaryIcon: Radio,
      accentColor: '#8B5CF6',
      badgeBg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
      borderGlow: 'hover:border-purple-400 dark:hover:border-purple-500',
    },
    {
      name: 'Electrical',
      label: 'High/Low Voltage Electrical',
      count: stats?.categoryCounts['Electrical'] || 0,
      icon: Activity,
      secondaryIcon: Sliders,
      accentColor: '#10B981',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
      borderGlow: 'hover:border-emerald-400 dark:hover:border-emerald-500',
    },
    {
      name: 'General / Other',
      label: 'General Maintenance & Tools',
      count: stats?.categoryCounts['General / Other'] || 0,
      icon: Package,
      secondaryIcon: Layers,
      accentColor: '#FF5A5F',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/50 text-[#FF5A5F]',
      borderGlow: 'hover:border-[#FF5A5F]',
    },
  ];

  const totalCount = stats?.total || 0;
  const overdueCount = stats?.overdue || 0;
  const pendingCount = stats?.pending || 0;
  const receivedOrCompleted = stats?.receivedOrCompleted || 0;
  const dueSoonCount = stats?.dueSoon || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome Banner in Grapefruit Theme */}
      <div className="relative overflow-hidden p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-[#881337] dark:from-slate-950 dark:via-slate-900 dark:to-[#4A1521] text-white shadow-xl border border-rose-900/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-[#FF5A5F] to-[#FF7A59] text-white shadow-sm">
                <Flame className="w-3.5 h-3.5 fill-current" />
                Office Material Demand Management
              </span>
              <span className="text-xs text-rose-200/80 font-medium hidden sm:inline">
                Live Countdown Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Materials Logistics & EDF Operations
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
              Real-time tracking of Employee Demand Forms with live Required-Date countdowns. Requisitions automatically turn <strong className="text-rose-400">RED</strong> when overdue.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs border border-white/20 hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              <UploadCloud className="w-4 h-4 text-[#FF7A59]" />
              <span>Import Excel</span>
            </button>
            <button
              onClick={onOpenCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-2xl bg-gradient-to-r from-[#FF5A5F] to-[#FF7A59] hover:from-[#E0484D] hover:to-[#FF5A5F] text-white shadow-lg shadow-[#FF5A5F]/30 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create New EDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* SPECIAL OVERDUE DETAIL BAR / ACCORDION BAR (User requested: "when i press the detail bar like over due it shows details of all the edfs") */}
      {overdueCount > 0 ? (
        <div
          onClick={onOpenOverdueDetails}
          className="p-5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-700 to-[#FF5A5F] text-white shadow-lg shadow-rose-900/20 cursor-pointer hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-rose-300 dark:border-rose-700 animate-pulse-glow"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center shrink-0 shadow-md animate-bounce">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight">
                  CRITICAL OVERDUE BAR ({overdueCount} REQUISITIONS EXPIRED)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/25 text-white">
                  CLICK TO INSPECT ALL DETAILS
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-0.5">
                Required delivery date has elapsed! Press this bar to inspect all EDF numbers, issue dates, crossed required dates, teams, and materials.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-4 py-2 rounded-xl bg-white text-rose-700 font-black text-xs shadow-md">
              Show Overdue Details &rarr;
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>All material requisitions are currently on schedule. No overdue items recorded.</span>
          </div>
          <span className="text-[11px] opacity-75">Live Required Date Watchdog Active</span>
        </div>
      )}

      {/* KPI Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total EDFs */}
        <div
          onClick={onNavigateToRecords}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer card-hover hover:border-[#FF5A5F]/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Submitted EDFs</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#FF5A5F] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {totalCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">requests</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#FF5A5F]" />
            <span>{stats?.totalMaterials || 0} technical items</span>
          </div>
        </div>

        {/* Pending Requests */}
        <div
          onClick={onNavigateToRecords}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer card-hover hover:border-amber-500/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Pending Execution</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400">
              {pendingCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {totalCount > 0 ? Math.round((pendingCount / totalCount) * 100) : 0}% active
            </span>
          </div>
          <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
            Awaiting store or vendor dispatch
          </div>
        </div>

        {/* Received / Completed */}
        <div
          onClick={onNavigateToRecords}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer card-hover hover:border-emerald-500/50 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Received / Completed</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {receivedOrCompleted}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              ({stats?.received || 0} rec / {stats?.completed || 0} comp)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Timer stopped on receipt
          </div>
        </div>

        {/* Overdue Requests - User requested: "ADDITIONALLY the overdue edf color should turn red" */}
        <div
          onClick={onOpenOverdueDetails}
          className={`p-5 rounded-2xl border-2 shadow-md cursor-pointer transition-all card-hover ${
            overdueCount > 0
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 dark:border-rose-600 ring-4 ring-rose-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-rose-700 dark:text-rose-300">
              Overdue Requests
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-rose-600 dark:text-rose-400">
              {overdueCount}
            </span>
            <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase animate-bounce">
              NEEDS ACTION
            </span>
          </div>
          <div className="mt-2 text-[11px] text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1">
            <span>Elapsed timers ticking</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* DOMAIN CARDS WITH RELEVANT DOMAIN ICONS (User requested: "add icons for relevant domains in the main dashboard") */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2 h-5 rounded-full bg-[#FF5A5F]" />
              Relevant Technical Domains & Request Volumes
            </h2>
            <p className="text-xs text-slate-500">
              Click any technical domain card to filter and manage its demand vouchers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {domainCards.map((domain) => {
            const Icon = domain.icon;
            const SubIcon = domain.secondaryIcon;
            const percentage = totalCount > 0 ? Math.round((domain.count / totalCount) * 100) : 0;

            return (
              <div
                key={domain.name}
                onClick={() => onNavigateToCategory(domain.name)}
                className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 cursor-pointer transition-all card-hover ${domain.borderGlow} group shadow-xs`}
              >
                <div className="flex items-center justify-between">
                  {/* Primary Domain Icon */}
                  <div className={`p-2.5 rounded-xl ${domain.badgeBg} group-hover:scale-110 transition-transform shadow-2xs`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {/* Secondary Domain Mini Icon */}
                  <SubIcon className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
                </div>

                <div className="mt-3.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block truncate group-hover:text-[#FF5A5F] transition-colors">
                    {domain.name}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {domain.label}
                  </span>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {domain.count}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      {percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700 bg-gradient-to-r from-[#FF5A5F] to-[#FF7A59]"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Widget for Auditability (Last 5 operations) */}
      <RecentActivityWidget
        activities={activities}
        onSelectEdfById={(edfId) => {
          const target = recentEdfs.find((e) => e.id === edfId);
          if (target) onSelectEdf(target);
        }}
        onRefresh={onRefreshActivities}
        isRefreshing={isRefreshingActivities}
      />

      {/* Recent Requests Table with Live Timers (Green -> Orange -> Red) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FF5A5F]" />
              Active EDFs & Live Schedule Timers
            </h3>
            <p className="text-xs text-slate-500">
              Timers count down gradually: <strong className="text-emerald-600">Green</strong> (created / on schedule) &rarr; <strong className="text-amber-600">Orange</strong> (1 day before / on required date) &rarr; <strong className="text-rose-600">Red</strong> (overdue).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenOverdueDetails}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1"
            >
              <span>Inspect Overdue ({overdueCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={onNavigateToRecords}
              className="text-xs font-bold text-[#FF5A5F] hover:underline"
            >
              View All Records
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3.5">EDF Number</th>
                <th className="py-3 px-3.5">Domain</th>
                <th className="py-3 px-3.5">Material Summary</th>
                <th className="py-3 px-3.5">Requesting Team</th>
                <th className="py-3 px-3.5">Issue Date</th>
                <th className="py-3 px-3.5">Required Date</th>
                <th className="py-3 px-3.5">Live Countdown / Timer</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentEdfs.slice(0, 8).map((edf) => {
                const isOverdue = edf.status === 'Overdue';

                return (
                  <tr
                    key={edf.id}
                    onClick={() => onSelectEdf(edf)}
                    className={`cursor-pointer transition-all card-hover ${
                      isOverdue
                        ? 'bg-rose-100/60 dark:bg-rose-950/40 border-l-4 border-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-900 dark:text-rose-100'
                        : 'hover:bg-rose-50/40 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* EDF Number */}
                    <td className="py-3.5 px-3.5 font-mono font-black">
                      <span className={isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}>
                        {edf.edfNumber}
                      </span>
                    </td>

                    {/* Domain */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <CategoryBadge category={edf.categoryName} size="sm" />
                    </td>

                    {/* Material Summary */}
                    <td className="py-3.5 px-3.5 max-w-[220px]">
                      <div className="font-bold truncate text-slate-900 dark:text-white">
                        {edf.requestDescription || 'Material demand'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {edf.materials && edf.materials.length > 0
                          ? `${edf.materials[0].materialName} (${edf.materials[0].quantity} ${edf.materials[0].unit})`
                          : 'No items listed'}
                      </div>
                    </td>

                    {/* Team */}
                    <td className="py-3.5 px-3.5 text-slate-700 dark:text-slate-300 truncate max-w-[130px] font-medium">
                      {edf.requestingTeam}
                    </td>

                    {/* Issue Date */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {new Date(edf.requestDate).toLocaleDateString()}
                    </td>

                    {/* Required Date */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <div className={`font-bold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {new Date(edf.requiredDate).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(edf.requiredDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Live Timer (Color phases: Green -> Orange -> Red) */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <CountdownBadge
                        requiredDate={edf.requiredDate}
                        status={edf.status}
                        receivedDate={edf.receivedDate}
                        completedDate={edf.completedDate}
                      />
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <StatusBadge status={edf.status} size="sm" />
                    </td>

                    {/* Quick Action */}
                    <td className="py-3.5 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {edf.status !== 'Received' && edf.status !== 'Completed' ? (
                        <button
                          onClick={() => onMarkReceived(edf.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-xs hover:scale-105 active:scale-95 transition-all"
                          title="Mark material received to stop timer"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Received</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          Delivered
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
