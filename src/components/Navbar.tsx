import React, { useState } from 'react';
import {
  Menu,
  Plus,
  Upload,
  Bell,
  RefreshCw,
  LogIn,
  LogOut,
  AlertTriangle,
  Clock,
  Sun,
  Moon,
  Sparkles,
  Flame,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { EDF } from '../types/index.ts';

interface NavbarProps {
  onToggleMobileMenu: () => void;
  onOpenCreate: () => void;
  onOpenImport: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  overdueEdfs: EDF[];
  dueSoonEdfs: EDF[];
  onSelectEdf: (edf: EDF) => void;
  onOpenOverdueDetails: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleMobileMenu,
  onOpenCreate,
  onOpenImport,
  onRefresh,
  isRefreshing,
  overdueEdfs,
  dueSoonEdfs,
  onSelectEdf,
  onOpenOverdueDetails,
}) => {
  const { user, signInWithGoogle, signOut } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);

  const totalAlerts = overdueEdfs.length + dueSoonEdfs.length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-rose-100 dark:border-slate-800 transition-colors">
      {/* Left: Mobile trigger & brand title with Grapefruit accent */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 text-slate-600 rounded-xl hover:bg-rose-50 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-tr from-[#FF5A5F] to-[#FF8E53] text-white shadow-xs">
              <Flame className="w-3.5 h-3.5 fill-current" />
            </span>
            <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
              EDF Requisition Operations
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-[#FF5A5F] dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
              Grapefruit Theme
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline">
            Required Date Live Engine • Green / Orange / Red Timers
          </span>
        </div>
      </div>

      {/* Right: Theme Switch, Actions, Alerts, Refresh, User profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Day / Night Theme Switch Button */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? 'Day Mode (Light)' : 'Night Mode (Dark)'}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
          aria-label="Toggle Day / Night theme"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
              <span className="text-xs font-bold text-amber-400">Night</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-700">Day</span>
            </>
          )}
        </button>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh data"
          className="p-2 text-slate-500 rounded-xl hover:bg-rose-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#FF5A5F]' : ''}`} />
        </button>

        {/* Overdue Quick Alert Trigger */}
        {overdueEdfs.length > 0 && (
          <button
            onClick={onOpenOverdueDetails}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-sm animate-pulse hover:scale-105 active:scale-95 transition-all"
            title="Inspect Overdue Requisitions Bar"
          >
            <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
            <span>{overdueEdfs.length} OVERDUE</span>
          </button>
        )}

        {/* Alerts Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
            className="relative p-2 text-slate-600 rounded-xl hover:bg-rose-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Active Notifications"
          >
            <Bell className="w-4 h-4" />
            {totalAlerts > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-ping-once">
                {totalAlerts}
              </span>
            )}
          </button>

          {/* Alerts Dropdown Modal */}
          {showAlertsDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAlertsDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-rose-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-3.5 bg-gradient-to-r from-rose-50 to-orange-50 dark:from-slate-950 dark:to-slate-900 border-b border-rose-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Alert Notifications ({totalAlerts})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowAlertsDropdown(false);
                      onOpenOverdueDetails();
                    }}
                    className="text-xs font-bold text-[#FF5A5F] hover:underline"
                  >
                    View Details
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {totalAlerts === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      All material demand forms are on schedule!
                    </div>
                  ) : (
                    <>
                      {/* Overdue Items */}
                      {overdueEdfs.map((edf) => (
                        <div
                          key={`overdue-${edf.id}`}
                          onClick={() => {
                            onSelectEdf(edf);
                            setShowAlertsDropdown(false);
                          }}
                          className="p-3 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-black text-rose-600 dark:text-rose-400">
                              {edf.edfNumber}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-black rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
                              OVERDUE
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                            {edf.requestDescription || edf.categoryName}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                            <span>{edf.requestingTeam}</span>
                            <span className="text-rose-600 font-bold">
                              Req: {new Date(edf.requiredDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Due Soon Items */}
                      {dueSoonEdfs.map((edf) => (
                        <div
                          key={`soon-${edf.id}`}
                          onClick={() => {
                            onSelectEdf(edf);
                            setShowAlertsDropdown(false);
                          }}
                          className="p-3 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                              {edf.edfNumber}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Due Soon
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                            {edf.requestDescription || edf.categoryName}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                            <span>{edf.requestingTeam}</span>
                            <span className="text-amber-600 font-semibold">
                              Due: {new Date(edf.requiredDate).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Import Table / Excel Button */}
        <button
          onClick={onOpenImport}
          title="Upload or Paste Text Table / Excel Requisition"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 hover:scale-105 active:scale-95 transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import Table / Excel</span>
        </button>

        {/* Create EDF Button in Grapefruit Theme */}
        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl text-white bg-gradient-to-r from-[#FF5A5F] to-[#FF7A59] hover:from-[#E0484D] hover:to-[#FF5A5F] shadow-sm shadow-[#FF5A5F]/30 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New EDF</span>
          <span className="sm:hidden">New</span>
        </button>

        {/* User Auth Info */}
        <div className="pl-2 border-l border-slate-200 dark:border-slate-800 flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF5A5F] to-[#FF8E53] text-white flex items-center justify-center text-xs font-bold ring-2 ring-[#FF5A5F]/30"
                title={user.email || 'Coordinator'}
              >
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'C'}
              </div>
              <button
                onClick={signOut}
                title="Sign out"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Google Sign-In"
            >
              <LogIn className="w-3.5 h-3.5 text-[#FF5A5F]" />
              <span className="hidden md:inline">Coordinator</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
