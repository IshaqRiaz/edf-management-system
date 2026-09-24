import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  PlusCircle,
  FileUp,
  AlertOctagon,
  FolderTree,
  BarChart3,
  Settings,
  HardHat,
  Flame,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.tsx';

export type NavTab =
  | 'dashboard'
  | 'records'
  | 'create'
  | 'import'
  | 'overdue'
  | 'categories'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  overdueCount: number;
  dueSoonCount: number;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  overdueCount,
  dueSoonCount,
  isOpen,
  onCloseMobile,
}) => {
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'records' as NavTab,
      label: 'EDF Records',
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      id: 'create' as NavTab,
      label: 'Create New EDF',
      icon: PlusCircle,
      badge: null,
    },
    {
      id: 'import' as NavTab,
      label: 'Import & Text Table',
      icon: FileUp,
      highlight: true,
      badge: 'Auto-Extract',
    },
    {
      id: 'overdue' as NavTab,
      label: 'Overdue Tracker',
      icon: AlertOctagon,
      badge: overdueCount > 0 ? `${overdueCount}` : null,
      badgeColor: 'rose',
    },
    {
      id: 'categories' as NavTab,
      label: 'Domains & Categories',
      icon: FolderTree,
      badge: null,
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports & Analytics',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-slate-950 text-slate-200 border-r border-slate-800/80 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header with Grapefruit Accent */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/80 bg-slate-950/90">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF5A5F] via-[#FF7A59] to-[#FFA07A] shadow-md shadow-[#FF5A5F]/20 text-white shrink-0">
            <Flame className="w-5 h-5 fill-current" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-black tracking-tight text-white truncate">
              EDF Material Hub
            </span>
            <span className="text-[11px] font-semibold text-rose-300/80 truncate">
              Office Coordinator Portal
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Navigation Menu
          </div>

          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FF5A5F] to-[#FF7A59] text-white shadow-md shadow-[#FF5A5F]/20 scale-[1.02]'
                    : 'text-slate-300 hover:bg-slate-900/90 hover:text-white hover:translate-x-1'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-rose-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                      item.badgeColor === 'rose'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Critical Watch Box with Grapefruit / Rose Alerts */}
        <div className="p-4 m-3 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-bold text-slate-300">Live Delivery Watch</span>
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          </div>
          <div className="flex items-center justify-between py-1.5 border-t border-slate-800 text-xs">
            <span className="text-slate-400">Overdue Requisitions:</span>
            <span
              className={`font-mono font-black ${
                overdueCount > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {overdueCount}
            </span>
          </div>
          <div className="flex items-center justify-between py-1 text-xs">
            <span className="text-slate-400">Due within 24h:</span>
            <span
              className={`font-mono font-bold ${
                dueSoonCount > 0 ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {dueSoonCount}
            </span>
          </div>
        </div>

        {/* Day / Night Theme Switcher in Sidebar */}
        <div className="px-3 pb-3">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
            title={`Switch to ${isDark ? 'Day Mode' : 'Night Mode'}`}
          >
            <div className="flex items-center gap-2">
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-400" />
              )}
              <span>{isDark ? 'Night Theme Active' : 'Day Theme Active'}</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Toggle
            </span>
          </button>
        </div>

        {/* Coordinator Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-white font-bold truncate">Materials Coordinator</span>
            <span className="text-[10px] text-slate-500 truncate">Central Stores & Technical Ops</span>
          </div>
        </div>
      </aside>
    </>
  );
};
