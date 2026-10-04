import React, { useState, useMemo } from 'react';
import { DashboardStats, EDF } from '../types.ts';
import { useTheme, AccentColor } from '../context/ThemeContext.tsx';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  FileText,
  Wind,
  Droplets,
  Zap,
  Phone,
  Sparkles,
  Layers,
  Clock,
  PackageCheck,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  History,
  PlusCircle,
  FileUp,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  Activity,
} from 'lucide-react';

interface DashboardProps {
  stats: DashboardStats;
  edfs?: EDF[];
  onFilterNavigate: (filterType: 'category' | 'status' | 'all' | 'overdue', value?: string) => void;
  onOpenCreate: () => void;
  onOpenImport: () => void;
  onExportCSV: () => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  isAdmin: boolean;
}

const CustomChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 rounded-2xl bg-slate-900/95 text-white dark:bg-slate-800/95 border border-slate-700 shadow-xl backdrop-blur-md text-xs space-y-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 pb-1.5">
          <span className="font-bold text-slate-200">{data.fullDate}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
            {data.day}
          </span>
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ring-2 ring-rose-500/30" />
            <span>EDFs Created:</span>
          </span>
          <span className="font-mono font-black text-sm text-white">{data.count}</span>
        </div>
        {data.categories && Object.keys(data.categories).length > 0 && (
          <div className="pt-1.5 border-t border-slate-700/60 space-y-1">
            <span className="text-[10px] text-slate-400 block font-bold">
              By Category:
            </span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.categories).map(([cat, cnt]) => (
                <span
                  key={cat}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 dark:bg-slate-700 text-slate-300 font-medium"
                >
                  {cat}: {cnt as number}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  edfs = [],
  onFilterNavigate,
  onOpenCreate,
  onOpenImport,
  onExportCSV,
  onRefresh,
  isRefreshing = false,
  isAdmin,
}) => {
  const { accent } = useTheme();
  const [activityFilter, setActivityFilter] = useState<'all' | 'creation' | 'update' | 'status' | 'deletion'>('all');

  const getActivityCategory = (action: string): 'creation' | 'update' | 'status' | 'deletion' | 'other' => {
    const act = action.toLowerCase();
    if (
      act.includes('marked as') ||
      act.includes('completed') ||
      act.includes('pending') ||
      act.includes('received') ||
      act.includes('status')
    ) {
      return 'status';
    }
    if (act.includes('creat') || act.includes('import')) {
      return 'creation';
    }
    if (act.includes('delet') || act.includes('remove')) {
      return 'deletion';
    }
    if (act.includes('updat') || act.includes('edit') || act.includes('reset')) {
      return 'update';
    }
    return 'other';
  };

  const filteredActivity = useMemo(() => {
    if (activityFilter === 'all') return stats.recentActivity;
    return stats.recentActivity.filter(
      (log) => getActivityCategory(log.action) === activityFilter
    );
  }, [stats.recentActivity, activityFilter]);

  const activityCounts = useMemo(() => {
    const counts = {
      all: stats.recentActivity.length,
      creation: 0,
      update: 0,
      status: 0,
      deletion: 0,
    };
    stats.recentActivity.forEach((log) => {
      const cat = getActivityCategory(log.action);
      if (cat === 'creation') counts.creation++;
      else if (cat === 'update') counts.update++;
      else if (cat === 'status') counts.status++;
      else if (cat === 'deletion') counts.deletion++;
    });
    return counts;
  }, [stats.recentActivity]);

  // Count partially received EDFs to recognize partial receiving in dashboard
  const partiallyReceivedCount = useMemo(() => {
    return edfs.filter(
      (e) =>
        e.status === 'Partially Received' ||
        (e.receivedItemsCount !== undefined &&
          e.totalItemsCount !== undefined &&
          e.receivedItemsCount > 0 &&
          e.receivedItemsCount < e.totalItemsCount)
    ).length;
  }, [edfs]);

  // Frequency of EDF creation over the last 7 days
  const sevenDayStats = useMemo(() => {
    const now = new Date();
    const days: {
      date: string;
      day: string;
      fullDate: string;
      count: number;
      categories: Record<string, number>;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${dayNum}`;
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const fullDate = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      let count = 0;
      const categories: Record<string, number> = {};

      if (edfs && edfs.length > 0) {
        edfs.forEach((item) => {
          const cDateVal = item.createdAt || item.issueDate;
          if (!cDateVal) return;
          const cd = new Date(cDateVal);
          if (isNaN(cd.getTime())) return;
          const cy = cd.getFullYear();
          const cm = String(cd.getMonth() + 1).padStart(2, '0');
          const cday = String(cd.getDate()).padStart(2, '0');
          if (`${cy}-${cm}-${cday}` === dateKey) {
            count++;
            const cat = item.category || 'General';
            categories[cat] = (categories[cat] || 0) + 1;
          }
        });
      } else if (stats.creationHistory7Days && stats.creationHistory7Days.length > 0) {
        const found = stats.creationHistory7Days.find((h) => h.date === dateKey);
        if (found) {
          count = found.count;
        }
      }

      days.push({
        date: dateKey,
        day: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : dayLabel,
        fullDate,
        count,
        categories,
      });
    }

    const totalIn7Days = days.reduce((acc, curr) => acc + curr.count, 0);
    const avgPerDay = (totalIn7Days / 7).toFixed(1);
    const peakDay = days.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), days[0]);

    return {
      chartData: days,
      totalIn7Days,
      avgPerDay,
      peakDay,
    };
  }, [edfs, stats.creationHistory7Days]);

  const getBannerGradient = (acc: AccentColor) => {
    switch (acc) {
      case 'grapefruit':
        return 'from-rose-500 via-rose-600 to-pink-700 shadow-rose-600/25';
      case 'slate':
        return 'from-slate-700 via-slate-800 to-slate-950 shadow-slate-900/30';
      case 'teal':
        return 'from-teal-600 via-teal-700 to-slate-900 shadow-teal-600/20';
      case 'amber':
        return 'from-amber-600 via-orange-600 to-slate-900 shadow-amber-600/20';
      case 'blue':
        return 'from-blue-600 via-blue-700 to-slate-900 shadow-blue-600/20';
      case 'indigo':
      default:
        return 'from-rose-500 via-rose-600 to-pink-700 shadow-rose-600/25';
    }
  };

  const getBannerBtnColor = (acc: AccentColor) => {
    switch (acc) {
      case 'grapefruit':
        return 'text-rose-700 hover:bg-rose-50';
      case 'slate':
        return 'text-slate-800 hover:bg-slate-100';
      case 'teal':
        return 'text-teal-700 hover:bg-teal-50';
      case 'amber':
        return 'text-amber-800 hover:bg-amber-50';
      case 'blue':
        return 'text-blue-700 hover:bg-blue-50';
      case 'indigo':
      default:
        return 'text-rose-700 hover:bg-rose-50';
    }
  };

  const getProgressGradient = (acc: AccentColor) => {
    switch (acc) {
      case 'grapefruit':
        return 'from-rose-500 to-pink-600';
      case 'slate':
        return 'from-slate-500 to-slate-700';
      case 'teal':
        return 'from-teal-400 to-teal-600';
      case 'amber':
        return 'from-amber-400 to-amber-600';
      case 'blue':
        return 'from-blue-400 to-blue-600';
      case 'indigo':
      default:
        return 'from-rose-500 to-pink-600';
    }
  };

  const getAccentText = (acc: AccentColor) => {
    switch (acc) {
      case 'grapefruit':
        return 'text-rose-600 dark:text-rose-400';
      case 'slate':
        return 'text-slate-700 dark:text-slate-300';
      case 'teal':
        return 'text-teal-600 dark:text-teal-400';
      case 'amber':
        return 'text-amber-600 dark:text-amber-400';
      case 'blue':
        return 'text-blue-600 dark:text-blue-400';
      case 'indigo':
      default:
        return 'text-rose-600 dark:text-rose-400';
    }
  };

  const getCategoryBarGradient = (categoryName: string) => {
    switch (categoryName.toLowerCase()) {
      case 'hvac':
        return 'from-sky-400 to-cyan-500';
      case 'plumbing':
        return 'from-blue-500 to-indigo-500';
      case 'generator':
        return 'from-amber-400 to-orange-500';
      case 'telephone':
        return 'from-teal-400 to-emerald-500';
      case 'electrical':
        return 'from-purple-500 to-fuchsia-500';
      case 'general':
        return 'from-slate-400 to-slate-600';
      default:
        return 'from-rose-400 to-rose-600';
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName.toLowerCase()) {
      case 'hvac':
        return Wind;
      case 'plumbing':
        return Droplets;
      case 'generator':
        return Zap;
      case 'telephone':
        return Phone;
      case 'electrical':
        return Sparkles;
      case 'general':
        return Layers;
      default:
        return FileText;
    }
  };
  // Category cards configuration
  const categoryCards = [
    {
      id: 'HVAC',
      name: 'HVAC',
      count: stats.hvac,
      icon: Wind,
      color: 'from-sky-500 to-cyan-500',
      bgColor: 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
    },
    {
      id: 'Plumbing',
      name: 'Plumbing',
      count: stats.plumbing,
      icon: Droplets,
      color: 'from-blue-500 to-indigo-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    },
    {
      id: 'Generator',
      name: 'Generator',
      count: stats.generator,
      icon: Zap,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    },
    {
      id: 'Telephone',
      name: 'Telephone',
      count: stats.telephone,
      icon: Phone,
      color: 'from-teal-500 to-emerald-500',
      bgColor: 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60',
    },
    {
      id: 'Electrical',
      name: 'Electrical',
      count: stats.electrical,
      icon: Sparkles,
      color: 'from-purple-500 to-fuchsia-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
    },
    {
      id: 'General',
      name: 'General',
      count: stats.general,
      icon: Layers,
      color: 'from-slate-500 to-slate-700',
      bgColor: 'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/60',
    },
  ];

  // Status cards configuration with distinct count colors and hover animations
  const statusCards = [
    {
      id: 'Pending',
      name: 'Pending',
      count: stats.pending,
      icon: Clock,
      countColor: 'text-amber-600 dark:text-amber-400',
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      hoverBorder: 'hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-amber-500/10',
    },
    {
      id: 'Received',
      name: 'Received',
      count: stats.received,
      icon: PackageCheck,
      countColor: 'text-sky-600 dark:text-sky-400',
      color: 'from-sky-500 to-blue-600',
      bgColor: 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
      hoverBorder: 'hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-sky-500/10',
    },
    {
      id: 'Completed',
      name: 'Completed',
      count: stats.completed,
      icon: CheckCircle2,
      countColor: 'text-emerald-600 dark:text-emerald-400',
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-emerald-500/10',
    },
    {
      id: 'Overdue',
      name: 'Overdue',
      count: stats.overdue,
      icon: AlertTriangle,
      countColor: 'text-rose-600 dark:text-rose-400 font-black',
      color: 'from-rose-500 to-red-600',
      bgColor: 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800',
      hoverBorder: 'hover:border-rose-500 hover:shadow-rose-500/20',
      isOverdue: true,
    },
  ];

  const total = Math.max(stats.total, 1);

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Welcome & Quick Action Bar (Compact Modern Size) */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${getBannerGradient(accent)} text-white shadow-xl transition-all duration-300 w-full min-w-0`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur text-[11px] font-bold">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Demand Form Coordinator Hub</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/25 backdrop-blur text-emerald-100 text-[10px] font-semibold border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Auto-refresh 5s</span>
            </div>
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight truncate">
            EDF Operational Overview
          </h2>
          <p className="text-rose-100 text-xs mt-0.5 max-w-xl font-medium">
            Monitor real-time demand statuses, live countdown deadlines, and department material requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={onOpenCreate}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-white ${getBannerBtnColor(accent)} font-extrabold text-xs shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create EDF</span>
              </button>
              <button
                onClick={onOpenImport}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs border border-white/25 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-2xs"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Import Excel and CSV</span>
              </button>
            </>
          )}
          <button
            onClick={onExportCSV}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-2xs"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* DASHBOARD REFRESH BUTTON WITH SMOOTH ANIMATION */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs border border-white/25 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Refresh all dashboard statistics and tables (Auto-refreshes every 5s)"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Header: Total EDFs & Status Breakdown */}
      <div className="w-full min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs font-black text-slate-900 dark:text-white truncate">
              Status Matrix (Click to filter)
            </h3>
            {stats.overdue > 0 && (
              <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse shrink-0">
                {stats.overdue} Action Required
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 shrink-0">Live operational status</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 w-full min-w-0">
          {/* Total EDFs Card */}
          <button
            onClick={() => onFilterNavigate('all')}
            className="group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Total EDFs
              </span>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {stats.total}
                </span>
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>+12%</span>
                </span>
              </div>

              {/* Trend line sparkline */}
              <div className="my-1.5 h-6 w-full overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 100 24" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="trend-total" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,20 Q20,16 40,14 T70,8 T100,4 L100,24 L0,24 Z" fill="url(#trend-total)" />
                  <path d="M0,20 Q20,16 40,14 T70,8 T100,4" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="100" cy="4" r="2" fill="#f43f5e" />
                </svg>
              </div>

              <div className={`flex items-center justify-between text-[11px] ${getAccentText(accent)} font-bold mt-1`}>
                <span>View all records</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* Pending, Received, Completed, Overdue */}
          {statusCards.map((card) => {
            const Icon = card.icon;
            const isOverdueAlert = card.isOverdue && card.count > 0;

            // Trend line configuration per card
            const trendConfig = {
              Pending: {
                color: '#f59e0b',
                gradientId: 'trend-pending',
                path: 'M0,14 Q25,8 50,16 T75,10 T100,12',
                endY: 12,
                badge: 'Queue flow',
              },
              Received: {
                color: '#0284c7',
                gradientId: 'trend-received',
                path: 'M0,20 Q30,18 55,12 T80,8 T100,5',
                endY: 5,
                badge: '+18% intake',
              },
              Completed: {
                color: '#10b981',
                gradientId: 'trend-completed',
                path: 'M0,22 Q35,20 60,12 T85,6 T100,3',
                endY: 3,
                badge: '96% rate',
              },
              Overdue: {
                color: '#e11d48',
                gradientId: 'trend-overdue',
                path: isOverdueAlert
                  ? 'M0,18 Q30,12 60,8 T80,4 T100,2'
                  : 'M0,6 Q30,14 60,18 T85,20 T100,22',
                endY: isOverdueAlert ? 2 : 22,
                badge: isOverdueAlert ? 'Attention' : 'Contained',
              },
            }[card.id] || {
              color: '#64748b',
              gradientId: `trend-${card.id}`,
              path: 'M0,16 Q50,8 100,16',
              endY: 16,
              badge: 'Steady',
            };

            return (
              <button
                key={card.id}
                onClick={() =>
                  card.isOverdue
                    ? onFilterNavigate('overdue')
                    : onFilterNavigate('status', card.id)
                }
                className={`group p-4 rounded-2xl bg-white dark:bg-slate-900 border ${
                  isOverdueAlert
                    ? 'border-2 border-rose-500 dark:border-rose-500 bg-rose-50/40 dark:bg-rose-950/25 shadow-md shadow-rose-500/20'
                    : `border-slate-200 dark:border-slate-800 ${card.hoverBorder}`
                } shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left flex flex-col justify-between cursor-pointer`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {card.name}
                  </span>
                  <div
                    className={`p-2 rounded-xl ${card.bgColor} ${
                      isOverdueAlert ? 'animate-bounce' : 'group-hover:scale-110'
                    } transition-transform`}
                  >
                    <Icon className={`w-4 h-4 ${isOverdueAlert ? 'text-rose-600 dark:text-rose-400' : ''}`} />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-1">
                    <span className={`text-2xl sm:text-3xl font-black tracking-tight ${card.countColor}`}>
                      {card.count}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded-md"
                      style={{
                        backgroundColor: `${trendConfig.color}15`,
                        color: trendConfig.color,
                      }}
                    >
                      {trendConfig.badge}
                    </span>
                  </div>

                  {/* Trend line sparkline */}
                  <div className="my-1.5 h-6 w-full overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 100 24" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id={trendConfig.gradientId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={trendConfig.color} stopOpacity="0.35" />
                          <stop offset="100%" stopColor={trendConfig.color} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`${trendConfig.path} L100,24 L0,24 Z`}
                        fill={`url(#${trendConfig.gradientId})`}
                      />
                      <path
                        d={trendConfig.path}
                        fill="none"
                        stroke={trendConfig.color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="100"
                        cy={trendConfig.endY}
                        r="2"
                        fill={trendConfig.color}
                      />
                    </svg>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-1 text-[11px]">
                    {card.id === 'Pending' && partiallyReceivedCount > 0 ? (
                      <span className="text-amber-700 dark:text-amber-300 font-extrabold text-[10px]">
                        {partiallyReceivedCount} Partial Intake
                      </span>
                    ) : isOverdueAlert ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-rose-600 text-white font-black text-[10px] animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <span>Requires Attention</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-semibold group-hover:text-slate-600 dark:group-hover:text-slate-200">
                        {Math.round((card.count / total) * 100)}% of total
                      </span>
                    )}
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-slate-400" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Partially Received Tracking Box (Requirement 6) */}
      {edfs.some(
        (e) =>
          e.status === 'Partially Received' ||
          ((e.receivedItemsCount || 0) > 0 && (e.receivedItemsCount || 0) < (e.totalItemsCount || 1))
      ) && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50/40 dark:from-sky-950/30 dark:to-indigo-950/20 border border-sky-200 dark:border-sky-900 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500 text-white shadow-xs">
                <PackageCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Partially Received Demands (In-Progress Intake)</span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
                    Tracked under Pending
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  These demands stay in Pending until all material items have arrived.
                </p>
              </div>
            </div>
            <button
              onClick={() => onFilterNavigate('status', 'Pending')}
              className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>View all pending</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {edfs
              .filter(
                (e) =>
                  e.status === 'Partially Received' ||
                  ((e.receivedItemsCount || 0) > 0 &&
                    (e.receivedItemsCount || 0) < (e.totalItemsCount || 1))
              )
              .slice(0, 6)
              .map((item) => {
                const rawItems = item.items || [];
                const totalCount =
                  item.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
                const receivedCount =
                  item.receivedItemsCount ??
                  rawItems.filter((i) => i.status === 'Received').length;
                return (
                  <div
                    key={item.id}
                    onClick={() => onFilterNavigate('status', 'Pending')}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-sky-100 dark:border-sky-900/60 shadow-2xs hover:border-sky-300 dark:hover:border-sky-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {item.edfNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Pending
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span className="text-sky-700 dark:text-sky-300 font-bold">
                        Partially Received
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {receivedCount}/{totalCount} Items Received
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{
                          width: `${Math.round((receivedCount / Math.max(totalCount, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7-DAY EDF CREATION FREQUENCY LINE CHART (RECHARTS)                        */}
      {/* ========================================================================= */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 shadow-2xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Edf Creation Frequency (Last 7 Days)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  Daily Trend
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Volume and trajectory of new employee demand forms generated over the past 7 days
              </p>
            </div>
          </div>

          {/* Metric Summary Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-bold">
                7-Day Total
              </span>
              <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                {sevenDayStats.totalIn7Days} <span className="text-xs font-normal text-slate-400">forms</span>
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-bold">
                Daily Average
              </span>
              <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                {sevenDayStats.avgPerDay} <span className="text-xs font-normal text-slate-400">/ day</span>
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
              <span className="text-[10px] text-rose-600 dark:text-rose-400 block font-bold">
                Peak Day
              </span>
              <span className="font-mono font-black text-rose-700 dark:text-rose-300 text-sm">
                {sevenDayStats.peakDay.day} ({sevenDayStats.peakDay.count})
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Line Chart Container */}
        <div className="w-full h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={sevenDayStats.chartData}
              margin={{ top: 12, right: 16, left: -20, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
                className="dark:stroke-slate-800"
              />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                dy={6}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'monospace' }}
                dx={-4}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Line
                type="monotone"
                dataKey="count"
                name="EDFs Created"
                stroke="#f43f5e"
                strokeWidth={3.5}
                dot={{ r: 4.5, fill: '#f43f5e', strokeWidth: 2.5, stroke: '#ffffff' }}
                activeDot={{ r: 7.5, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Summary Cards (Clickable) */}
      <div className="w-full min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-slate-900 dark:text-white">
            Category Demands (Click to filter)
          </h3>
          <span className="text-[11px] text-slate-400">Department distribution</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 w-full min-w-0">
          {categoryCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => onFilterNavigate('category', card.id)}
                className="group p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-left cursor-pointer min-w-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`p-2 rounded-xl ${card.bgColor} group-hover:scale-110 transition-transform shrink-0`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                    {Math.round((card.count / total) * 100)}%
                  </span>
                </div>
                <div className="mt-2 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {card.name}
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {card.count}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 w-full min-w-0">
        {/* Category Breakdown Chart Card - With matching Domain Gradients & Category Icons */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm w-full min-w-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h4 className="text-xs font-black text-slate-900 dark:text-white">
              Category Distribution
            </h4>
            <span className="text-xs text-slate-400 font-mono font-bold">Total: {stats.total}</span>
          </div>

          <div className="space-y-3">
            {stats.categoryDistribution.map((item) => {
              const pct = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
              const CatIcon = getCategoryIcon(item.name);
              const barGradient = getCategoryBarGradient(item.name);

              return (
                <div
                  key={item.name}
                  onClick={() => onFilterNavigate('category', item.name)}
                  className="cursor-pointer group p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <div className="flex items-center gap-1.5">
                      <CatIcon className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
                      <span className="text-slate-700 dark:text-slate-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${barGradient} rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${Math.max(pct, item.count > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Distribution Chart Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Status Breakdown
            </h4>
            <span className="text-xs text-slate-400">Progress</span>
          </div>

          {/* Large Visual Progress Bar */}
          <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex mb-6">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${(stats.pending / total) * 100}%` }}
              title={`Pending: ${stats.pending}`}
            />
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${(stats.received / total) * 100}%` }}
              title={`Received: ${stats.received}`}
            />
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(stats.completed / total) * 100}%` }}
              title={`Completed: ${stats.completed}`}
            />
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${(stats.overdue / total) * 100}%` }}
              title={`Overdue: ${stats.overdue}`}
            />
          </div>

          {/* Details list */}
          <div className="space-y-3">
            {stats.statusDistribution.map((st) => {
              const pct = stats.total > 0 ? Math.round((st.count / stats.total) * 100) : 0;
              return (
                <div
                  key={st.name}
                  onClick={() =>
                    st.name === 'Overdue'
                      ? onFilterNavigate('overdue')
                      : onFilterNavigate('status', st.name)
                  }
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: st.color }}
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {st.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                    {st.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Card with Action Type Filter Dropdown */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between overflow-hidden w-full max-w-full">
          <div className="w-full min-w-0">
            {/* Header with Title and Filter Dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2.5 mb-3 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                    Recent Activity
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      {filteredActivity.length}
                    </span>
                  </h4>
                </div>
              </div>

              {/* Action Type Filter Dropdown - Responsive & constrained */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0 max-w-full">
                <label htmlFor="activity-action-filter" className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Type:</span>
                </label>
                <div className="relative flex-1 sm:w-44 min-w-0 max-w-full">
                  <select
                    id="activity-action-filter"
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value as any)}
                    className="w-full min-w-0 max-w-full truncate pl-2.5 pr-7 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs transition-colors"
                    aria-label="Filter recent activity by action type"
                  >
                    <option value="all">All Actions ({activityCounts.all})</option>
                    <option value="creation">Creation ({activityCounts.creation})</option>
                    <option value="update">Update ({activityCounts.update})</option>
                    <option value="status">Status ({activityCounts.status})</option>
                    <option value="deletion">Deletion ({activityCounts.deletion})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Filter Pill Buttons - Constrained to prevent horizontal blowout */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-thin max-w-full text-xs">
              {[
                { id: 'all', label: 'All', count: activityCounts.all },
                { id: 'creation', label: 'Creation', count: activityCounts.creation },
                { id: 'update', label: 'Update', count: activityCounts.update },
                { id: 'status', label: 'Status', count: activityCounts.status },
                { id: 'deletion', label: 'Deletion', count: activityCounts.deletion },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActivityFilter(tab.id as any)}
                  className={`px-2 py-0.5 rounded-lg font-semibold text-[10px] sm:text-[11px] whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    activityFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Activity Items List */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-0.5">
              {filteredActivity.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {activityFilter === 'all'
                      ? 'No recent activity recorded.'
                      : `No "${activityFilter.replace('_', ' ')}" actions found in recent history.`}
                  </p>
                  {activityFilter !== 'all' && (
                    <button
                      onClick={() => setActivityFilter('all')}
                      className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Show all activities
                    </button>
                  )}
                </div>
              ) : (
                filteredActivity.map((log) => {
                  const cat = getActivityCategory(log.action);
                  const dateObj = new Date(log.createdAt);
                  const isToday =
                    new Date().toDateString() === dateObj.toDateString();
                  const timeFormatted = dateObj.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const dateStr = isToday
                    ? `Today at ${timeFormatted}`
                    : `${dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeFormatted}`;

                  const getBadge = () => {
                    switch (cat) {
                      case 'creation':
                        return {
                          label: 'Creation',
                          style:
                            'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                          dot: 'bg-emerald-500',
                        };
                      case 'update':
                        return {
                          label: 'Update',
                          style:
                            'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
                          dot: 'bg-indigo-500',
                        };
                      case 'status':
                        return {
                          label: 'Status Change',
                          style:
                            'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                          dot: 'bg-amber-500',
                        };
                      case 'deletion':
                        return {
                          label: 'Deletion',
                          style:
                            'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
                          dot: 'bg-red-500',
                        };
                      default:
                        return {
                          label: 'Activity',
                          style:
                            'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
                          dot: 'bg-slate-400',
                        };
                    }
                  };

                  const badge = getBadge();

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-start gap-3 group"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${badge.dot} mt-1.5 shrink-0 shadow-xs`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {log.action}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${badge.style}`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          {log.edfNumber && (
                            <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {log.edfNumber}
                            </span>
                          )}
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {log.userName || log.userPhone || 'System'}
                          </span>
                          <span>•</span>
                          <span>{dateStr}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
