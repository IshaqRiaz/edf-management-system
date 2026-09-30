import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme, AccentColor } from '../context/ThemeContext.tsx';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Kanban,
  PlusCircle,
  FileUp,
  AlertOctagon,
  Users,
  BarChart3,
  History,
  Settings,
  ShieldAlert,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'edfs'
  | 'board'
  | 'create'
  | 'import'
  | 'overdue'
  | 'users'
  | 'reports'
  | 'audit_log'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
  overdueCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
  overdueCount,
}) => {
  const { isAdmin } = useAuth();
  const { accent } = useTheme();

  const getActiveNavClass = (acc: AccentColor) => {
    switch (acc) {
      case 'grapefruit':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold border border-rose-200/80 dark:border-rose-900/50 shadow-xs';
      case 'slate':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-300 dark:border-slate-700 shadow-xs';
      case 'teal':
        return 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold border border-teal-200/80 dark:border-teal-900/50 shadow-xs';
      case 'amber':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold border border-amber-200/80 dark:border-amber-900/50 shadow-xs';
      case 'blue':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200/80 dark:border-blue-900/50 shadow-xs';
      case 'indigo':
      default:
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold border border-rose-200/80 dark:border-rose-900/50 shadow-xs';
    }
  };

  const getActiveIconClass = (acc: AccentColor) => {
    switch (acc) {
      case 'grapefruit':
        return 'text-rose-600 dark:text-rose-400';
      case 'slate':
        return 'text-slate-800 dark:text-slate-200';
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

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      adminOnly: false,
    },
    {
      id: 'edfs' as NavTab,
      label: 'EDF List',
      icon: FileSpreadsheet,
      adminOnly: false,
    },
    {
      id: 'board' as NavTab,
      label: 'Board',
      icon: Kanban,
      adminOnly: false,
    },
    {
      id: 'create' as NavTab,
      label: 'Create EDF',
      icon: PlusCircle,
      adminOnly: true,
      highlight: true,
    },
    {
      id: 'import' as NavTab,
      label: 'Import Excel',
      icon: FileUp,
      adminOnly: true,
    },
    {
      id: 'overdue' as NavTab,
      label: 'Overdue',
      icon: AlertOctagon,
      adminOnly: false,
      badge: overdueCount > 0 ? overdueCount : undefined,
      isOverdueNav: true,
    },
    {
      id: 'users' as NavTab,
      label: 'Users',
      icon: Users,
      adminOnly: true,
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports',
      icon: BarChart3,
      adminOnly: false,
    },
    {
      id: 'audit_log' as NavTab,
      label: 'Audit Log',
      icon: History,
      adminOnly: false,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
      adminOnly: false,
    },
  ];

  return (
    <>
      {/* Universal Backdrop (desktop & mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer"
          onClick={onClose}
          title="Click to hide side panel"
          aria-label="Close navigation overlay"
        />
      )}

      {/* Sidebar Drawer Panel - Smooth Slide in/out Animation from Left */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 sm:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="p-4 flex flex-col gap-1 overflow-y-auto">
          {/* Header inside side panel with Brand and Close Button */}
          <div className="flex items-center justify-between pb-3.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 via-rose-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25 font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white block">
                  Navigation Menu
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Coordinator Control Center
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Hide Navigation Panel"
              aria-label="Close navigation panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const disabledForVisitor = item.adminOnly && !isAdmin;

            return (
              <button
                key={item.id}
                disabled={disabledForVisitor}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all text-left cursor-pointer ${
                  disabledForVisitor
                    ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600'
                    : isActive
                    ? item.isOverdueNav
                      ? 'bg-red-600 text-white shadow-md shadow-red-500/25 font-bold'
                      : getActiveNavClass(accent)
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={disabledForVisitor ? 'Admin role required' : item.label}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? item.isOverdueNav
                          ? 'text-white'
                          : getActiveIconClass(accent)
                        : item.isOverdueNav && item.badge
                        ? 'text-red-500'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold leading-none ${
                        isActive && item.isOverdueNav
                          ? 'bg-white text-red-600'
                          : 'bg-red-500 text-white shadow-sm'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {disabledForVisitor && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      Admin
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom role status indicator */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  isAdmin ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'
                }`}
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAdmin ? 'Admin Mode (Active)' : 'Visitor Mode'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {isAdmin
                ? 'Full permissions to create, edit, import, and delete EDFs.'
                : 'Read-only access. Search and view details only.'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
