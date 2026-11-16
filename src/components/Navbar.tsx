import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme, COLOR_THEMES } from '../context/ThemeContext.tsx';
import { EDF } from '../types.ts';
import { calculateLiveTimer } from '../utils/timer.ts';
import { getCategoryBadgeClass } from '../utils/categoryColors.ts';
import { getEffectiveEdfState } from '../utils/exportHelpers.ts';
import { searchEdfsGlobally } from '../utils/searchHelpers.ts';
import { HighlightText } from './HighlightText.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { OfflineSyncBar } from './OfflineSyncBar.tsx';
import {
  Sun,
  Moon,
  LogOut,
  KeyRound,
  Shield,
  User as UserIcon,
  Menu,
  Sparkles,
  ChevronDown,
  AlertCircle,
  Palette,
  Check,
  Bell,
  Clock,
  AlertTriangle,
  ArrowRight,
  PackageCheck,
  Package,
  History,
  CheckCheck,
  Trash2,
  Search,
  X,
} from 'lucide-react';

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onOpenSettings?: () => void;
  overdueCount?: number;
  onNavigateToOverdue?: () => void;
  onNavigateToAuditLog?: () => void;
  edfs?: EDF[];
  onSelectEdf?: (edf: EDF) => void;
  onViewAllSearchResults?: (query: string) => void;
  pendingSyncCount?: number;
  isSyncing?: boolean;
  onSyncNow?: () => void;
}

export interface StatusNotification {
  id: string;
  edfId: number;
  edfNumber: string;
  fromStatus: string;
  toStatus: string;
  requesterName?: string;
  category?: string;
  timestamp: string;
  isRead: boolean;
  isUserCreated: boolean;
  isMonitored: boolean;
  notificationTitle?: string;
  notificationMessage?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  isSidebarOpen = false,
  onOpenSettings,
  overdueCount = 0,
  onNavigateToOverdue,
  onNavigateToAuditLog,
  edfs = [],
  onSelectEdf,
  onViewAllSearchResults,
  pendingSyncCount = 0,
  isSyncing = false,
  onSyncNow,
}) => {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme, accent, setAccent } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Global EDF search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Local notification history array
  const [notifications, setNotifications] = useState<StatusNotification[]>(() => {
    try {
      const stored = localStorage.getItem('edf_status_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Track monitored mode: 'all' or 'created_and_monitored'
  const [monitorMode, setMonitorMode] = useState<'all' | 'created_and_monitored'>(() => {
    try {
      return (localStorage.getItem('edf_monitor_mode') as 'all' | 'created_and_monitored') || 'all';
    } catch {
      return 'all';
    }
  });

  // Track explicitly monitored EDF IDs
  const [monitoredEdfIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('monitored_edf_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const accentOptions = COLOR_THEMES.map((opt) => ({
    id: opt.id,
    label: opt.id === 'grapefruit' ? `${opt.label} (Default)` : opt.label,
    bg: opt.swatchClass,
  }));

  // Calculate live overdue count and due within 24 hours for live watch card
  const liveStats = useMemo(() => {
    let overdue = 0;
    let due24h = 0;
    for (const e of edfs) {
      if (e.status === 'Received') continue;
      const timer = calculateLiveTimer(e.requiredDate);
      if (timer.isOverdue || e.status === 'Overdue' || !!e.isOverdue) {
        overdue++;
      } else if (timer.color === 'orange' || timer.isTodayOrTomorrow) {
        due24h++;
      }
    }
    return { overdue, due24h };
  }, [edfs]);

  // Status Change Detection: Detects when an EDF the user created or is monitoring has its status updated
  useEffect(() => {
    if (!edfs || edfs.length === 0) return;

    let prevStatuses: Record<number, string> = {};
    try {
      const stored = localStorage.getItem('previous_edf_statuses');
      if (stored) prevStatuses = JSON.parse(stored);
    } catch {
      prevStatuses = {};
    }

    const isUserEdf = (edf: EDF) => {
      if (!user) return false;
      return (
        edf.createdBy === user.phone ||
        edf.createdBy === user.name ||
        edf.requesterName?.toLowerCase() === user.name?.toLowerCase()
      );
    };

    const isMonitored = (edf: EDF) => {
      if (monitorMode === 'all') return true;
      if (isUserEdf(edf)) return true;
      return monitoredEdfIds.includes(edf.id);
    };

    const newAlerts: StatusNotification[] = [];
    const updatedStatuses: Record<number, string> = { ...prevStatuses };

    edfs.forEach((edf) => {
      const oldStatus = prevStatuses[edf.id];
      if (oldStatus && oldStatus !== edf.status) {
        // Status has been updated!
        if (isMonitored(edf)) {
          const rawItems = edf.items || [];
          const totalCount = edf.totalItemsCount ?? (rawItems.length > 0 ? rawItems.length : 1);
          const receivedCount = edf.receivedItemsCount ?? rawItems.filter((i) => i.status === 'Received').length;

          let notifTitle = `${edf.edfNumber} Status Updated`;
          let notifMessage = `Status updated to ${edf.status}`;

          if (edf.status === 'Partially Received') {
            notifTitle = `${edf.edfNumber} Partially Received`;
            notifMessage = `${receivedCount} of ${totalCount} items have been received.`;
          } else if (edf.status === 'Received') {
            notifTitle = `${edf.edfNumber} Received`;
            notifMessage = `All ${totalCount} items have been received.`;
          }

          newAlerts.push({
            id: `notif-${edf.id}-${edf.status}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            edfId: edf.id,
            edfNumber: edf.edfNumber,
            fromStatus: oldStatus,
            toStatus: edf.status,
            requesterName: edf.requesterName,
            category: edf.category,
            timestamp: new Date().toISOString(),
            isRead: false,
            isUserCreated: isUserEdf(edf),
            isMonitored: true,
            notificationTitle: notifTitle,
            notificationMessage: notifMessage,
          });
        }
      }
      updatedStatuses[edf.id] = edf.status;
    });

    // Seed 2-3 recent status items if history array is completely empty on fresh setup
    if (notifications.length === 0 && Object.keys(prevStatuses).length === 0) {
      const recentUpdates = edfs
        .filter((e) => e.status === 'Received' || e.status === 'Partially Received')
        .slice(0, 3);
      recentUpdates.forEach((item, idx) => {
        newAlerts.push({
          id: `seed-${item.id}-${idx}`,
          edfId: item.id,
          edfNumber: item.edfNumber,
          fromStatus: 'Pending',
          toStatus: item.status,
          requesterName: item.requesterName,
          category: item.category,
          timestamp: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
          isRead: idx > 0,
          isUserCreated: isUserEdf(item),
          isMonitored: true,
        });
      });
    }

    if (newAlerts.length > 0) {
      setNotifications((prev) => {
        const merged = [...newAlerts, ...prev].slice(0, 50); // retain latest 50 notifications
        try {
          localStorage.setItem('edf_status_notifications', JSON.stringify(merged));
        } catch {}
        return merged;
      });
    }

    try {
      localStorage.setItem('previous_edf_statuses', JSON.stringify(updatedStatuses));
    } catch {}
  }, [edfs, user, monitorMode, monitoredEdfIds]);

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, isRead: true }));
      try {
        localStorage.setItem('edf_status_notifications', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const markOneAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      try {
        localStorage.setItem('edf_status_notifications', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearNotificationHistory = () => {
    setNotifications([]);
    try {
      localStorage.removeItem('edf_status_notifications');
    } catch {}
  };

  const handleNotificationClick = async (notif: StatusNotification) => {
    markOneAsRead(notif.id);
    setShowNotifications(false);

    // 1. If we have a local EDF, optimistically open it immediately
    const targetEdf = edfs.find(
      (e) => e.id === notif.edfId || (notif.edfNumber && e.edfNumber.toLowerCase() === notif.edfNumber.toLowerCase())
    );

    if (targetEdf && onSelectEdf) {
      onSelectEdf(targetEdf);
    }

    // 2. Fetch the full, fresh EDF from the server to guarantee complete material items, history, and notes
    const idToFetch = notif.edfId || targetEdf?.id;
    if (idToFetch) {
      try {
        const res = await fetch(`/api/edfs/${idToFetch}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('edf_auth_token')}` },
        });
        if (res.ok) {
          const fullEdf = await res.json();
          if (onSelectEdf) onSelectEdf(fullEdf);
          return;
        }
      } catch (err) {
        console.error('Failed to load full EDF for notification:', err);
      }
    } else if (notif.edfNumber) {
      // Search by edfNumber if ID is missing
      try {
        const res = await fetch(`/api/edfs?search=${encodeURIComponent(notif.edfNumber)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('edf_auth_token')}` },
        });
        if (res.ok) {
          const list = await res.json();
          const match = list.find((e: any) => e.edfNumber.toLowerCase() === notif.edfNumber.toLowerCase());
          if (match && onSelectEdf) {
            const detailRes = await fetch(`/api/edfs/${match.id}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('edf_auth_token')}` },
            });
            if (detailRes.ok) {
              const fullMatch = await detailRes.json();
              onSelectEdf(fullMatch);
              return;
            }
            onSelectEdf(match);
          }
        }
      } catch (err) {
        console.error('Failed to search EDF for notification:', err);
      }
    }
  };

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const formatTimeAgo = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Received':
        return <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'Partially Received':
        return <Package className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case 'Overdue':
        return <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'Pending':
      default:
        return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  // Global search results & quick recent records
  const trimmedSearch = searchQuery.trim();
  const searchResults = useMemo(
    () => searchEdfsGlobally(edfs, searchQuery, 8),
    [edfs, searchQuery]
  );

  const recentQuickEdfs = useMemo(() => {
    return [...edfs].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)).slice(0, 4);
  }, [edfs]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Global keyboard shortcuts: "/" or Cmd/Ctrl + K focuses Navbar search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const isSlash = !isTypingTarget && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey;

      if (isCmdK || isSlash) {
        e.preventDefault();
        setShowNotifications(false);
        setShowPaletteMenu(false);
        setShowProfileMenu(false);
        setIsSearchOpen(true);

        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setIsMobileSearchOpen(true);
          requestAnimationFrame(() => mobileInputRef.current?.focus());
        } else {
          desktopInputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    if (!isSearchOpen && !isMobileSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDesktop = desktopSearchRef.current?.contains(target);
      const inMobile = mobileSearchRef.current?.contains(target);
      if (!inDesktop && !inMobile) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchOpen, isMobileSearchOpen]);

  const handleSelectSearchEdf = async (edf: EDF) => {
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    if (onSelectEdf) {
      onSelectEdf(edf);
    }

    // Fetch fresh EDF details in background so items & history are completely up to date
    try {
      const token = localStorage.getItem('edf_auth_token');
      if (!token) return;
      const res = await fetch(`/api/edfs/${edf.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok && onSelectEdf) {
        const fullEdf = await res.json();
        onSelectEdf(fullEdf);
      }
    } catch {
      // Optimistically opened local EDF already
    }
  };

  const handleViewAllResults = () => {
    if (!trimmedSearch || !onViewAllSearchResults) return;
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    onViewAllSearchResults(trimmedSearch);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const activeListCount = trimmedSearch ? searchResults.matches.length : recentQuickEdfs.length;
    const hasViewAllRow = Boolean(trimmedSearch && searchResults.totalCount > 0 && onViewAllSearchResults);
    const maxIndex = hasViewAllRow ? activeListCount : Math.max(0, activeListCount - 1);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsSearchOpen(true);
      if (activeListCount > 0) {
        setHighlightedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsSearchOpen(true);
      if (activeListCount > 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (trimmedSearch) {
        if (e.shiftKey || (hasViewAllRow && highlightedIndex === activeListCount)) {
          handleViewAllResults();
          return;
        }
        const chosen = searchResults.matches[highlightedIndex]?.edf || searchResults.matches[0]?.edf;
        if (chosen) {
          handleSelectSearchEdf(chosen);
        }
      } else {
        const chosen = recentQuickEdfs[highlightedIndex];
        if (chosen) {
          handleSelectSearchEdf(chosen);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsSearchOpen(false);
      setIsMobileSearchOpen(false);
      e.currentTarget.blur();
    }
  };

  const getStatusTextMeta = (edf: EDF) => {
    const state = getEffectiveEdfState(edf);
    switch (state.effectiveStatus) {
      case 'Received':
        return {
          label: 'Received',
          className: 'text-emerald-700 dark:text-emerald-400',
          icon: <PackageCheck className="w-3.5 h-3.5 shrink-0" />,
        };
      case 'Partially Received':
        return {
          label: `Partial (${state.receivedItems}/${state.totalItems})`,
          className: 'text-sky-700 dark:text-sky-400',
          icon: <Package className="w-3.5 h-3.5 shrink-0" />,
        };
      case 'Overdue':
        return {
          label: 'Overdue',
          className: 'text-red-700 dark:text-red-400',
          icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
        };
      case 'Pending':
      default:
        return {
          label: 'Pending',
          className: 'text-amber-700 dark:text-amber-400',
          icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
        };
    }
  };

  const renderSearchDropdown = () => {
    if (!isSearchOpen) return null;
    const idTokenQuery = trimmedSearch.replace(/^#/, '');

    return (
      <div
        role="listbox"
        aria-label="EDF search results"
        className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden"
      >
        {trimmedSearch ? (
          <>
            {/* Search Results Summary Header */}
            <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                {searchResults.totalCount === 0
                  ? 'No matching EDF records'
                  : `${searchResults.totalCount} matching EDF${searchResults.totalCount === 1 ? '' : 's'}`}
              </span>
              {searchResults.totalCount > 0 && onViewAllSearchResults && (
                <button
                  type="button"
                  onClick={handleViewAllResults}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Filter in EDF List</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {searchResults.matches.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                  <Search className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  No EDFs found for &ldquo;{trimmedSearch}&rdquo;
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Try searching by EDF number, numeric ID (#12), requester name, or material description.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    desktopInputRef.current?.focus();
                    mobileInputRef.current?.focus();
                  }}
                  className="mt-3 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                {searchResults.matches.map((match, idx) => {
                  const { edf, matchingItems, matchedBy } = match;
                  const statusMeta = getStatusTextMeta(edf);
                  const isActive = idx === highlightedIndex;
                  const primaryItem = matchingItems[0];
                  const extraMatchCount = matchingItems.length > 1 ? matchingItems.length - 1 : 0;
                  const totalItems = edf.totalItemsCount ?? (edf.items?.length || 1);

                  return (
                    <button
                      key={edf.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelectSearchEdf(edf)}
                      className={`w-full text-left px-3.5 py-2.5 min-h-[44px] transition-colors cursor-pointer flex flex-col gap-1 ${
                        isActive
                          ? 'bg-rose-50/80 dark:bg-slate-800/90'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Row 1: EDF Number, #ID, and semantic status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white tabular-nums truncate">
                            <HighlightText text={edf.edfNumber} query={trimmedSearch} />
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                            #
                            <HighlightText
                              text={String(edf.id)}
                              query={/^\d+$/.test(idTokenQuery) ? idTokenQuery : ''}
                            />
                          </span>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap shrink-0 ${statusMeta.className}`}>
                          {statusMeta.icon}
                          <span>{statusMeta.label}</span>
                        </span>
                      </div>

                      {/* Row 2: Unboxed metadata (Requester · Category · Items count) */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 truncate">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          <HighlightText text={edf.requesterName || 'Unknown requester'} query={trimmedSearch} />
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                          {edf.category || 'General'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                          {totalItems} item{totalItems === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Row 3: Matching material item description preview */}
                      {primaryItem ? (
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="truncate">
                            Material:{' '}
                            <span className="text-slate-700 dark:text-slate-200 font-medium">
                              <HighlightText text={primaryItem.itemDescription} query={trimmedSearch} />
                            </span>
                            <span className="ml-1 font-mono tabular-nums text-slate-400 dark:text-slate-500">
                              ({primaryItem.quantity} {primaryItem.unit})
                            </span>
                          </span>
                          {extraMatchCount > 0 && (
                            <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0 tabular-nums">
                              +{extraMatchCount} more
                            </span>
                          )}
                        </div>
                      ) : matchedBy.material && edf.materialList ? (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Material:{' '}
                          <span className="text-slate-700 dark:text-slate-200 font-medium">
                            <HighlightText text={edf.materialList} query={trimmedSearch} />
                          </span>
                        </div>
                      ) : edf.items && edf.items.length > 0 ? (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {edf.items[0].itemDescription}
                          {edf.items.length > 1 ? ` · +${edf.items.length - 1} more items` : ''}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer: Jump to full filtered list */}
            {searchResults.totalCount > 0 && onViewAllSearchResults && (
              <button
                type="button"
                onMouseEnter={() => setHighlightedIndex(searchResults.matches.length)}
                onClick={handleViewAllResults}
                className={`w-full px-3.5 py-2.5 border-t border-slate-100 dark:border-slate-800 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                  highlightedIndex === searchResults.matches.length
                    ? 'bg-rose-50 dark:bg-slate-800 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-50/70 dark:bg-slate-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-slate-800/70'
                }`}
              >
                <span className="tabular-nums">
                  View all {searchResults.totalCount} matching record{searchResults.totalCount === 1 ? '' : 's'} in EDF List
                </span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Quick Jump — Recent EDFs
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Search by ID, requester, or material
              </span>
            </div>

            {recentQuickEdfs.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-400 dark:text-slate-500">
                No EDF records loaded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentQuickEdfs.map((edf, idx) => {
                  const statusMeta = getStatusTextMeta(edf);
                  const isActive = idx === highlightedIndex;
                  const totalItems = edf.totalItemsCount ?? (edf.items?.length || 1);

                  return (
                    <button
                      key={edf.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelectSearchEdf(edf)}
                      className={`w-full text-left px-3.5 py-2.5 min-h-[44px] transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-rose-50/80 dark:bg-slate-800/90'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white tabular-nums">
                            {edf.edfNumber}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                            #{edf.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {edf.requesterName} · {edf.category} · {totalItems} item{totalItems === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap shrink-0 ${statusMeta.className}`}>
                        {statusMeta.icon}
                        <span>{statusMeta.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-30 w-full max-w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-rose-100 dark:border-slate-800 transition-colors shadow-xs">
      <div className="px-2.5 sm:px-4 lg:px-6 h-16 flex items-center justify-between gap-1.5 sm:gap-4 w-full max-w-full">
        {/* Left side: Navigation Toggle & Brand */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
          <button
            onClick={onToggleSidebar}
            className={`flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 rounded-xl transition-all cursor-pointer border whitespace-nowrap shrink-0 ${
              isSidebarOpen
                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-rose-50/70 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
            }`}
            title={isSidebarOpen ? 'Hide Navigation Panel' : 'Open Navigation Panel'}
            aria-label="Toggle navigation menu"
          >
            <Menu className={`w-5 h-5 transition-transform duration-200 ${isSidebarOpen ? 'rotate-90 text-rose-600 dark:text-rose-400' : ''}`} />
            <span className="hidden sm:inline text-xs font-bold">
              {isSidebarOpen ? 'Close Menu' : 'Menu'}
            </span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-rose-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25 font-bold shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-sm sm:text-lg truncate block">
                  EDF Management
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden xl:block whitespace-nowrap">
                Employee Demand Form Control Center
              </p>
            </div>
          </div>
        </div>

        {/* Center: Global EDF Search Bar (Desktop & Tablet) */}
        <div ref={desktopSearchRef} className="hidden md:flex flex-1 min-w-0 max-w-md xl:max-w-lg mx-1 sm:mx-2 relative">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={desktopInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => {
                setIsSearchOpen(true);
                setShowNotifications(false);
                setShowPaletteMenu(false);
                setShowProfileMenu(false);
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search EDF ID, requester, or material..."
              aria-label="Global search for EDFs by ID, requester name, or material description"
              aria-expanded={isSearchOpen}
              className="w-full h-10 pl-9 pr-16 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 dark:focus:border-rose-500 transition-colors"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  desktopInputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span
                aria-hidden="true"
                className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-mono text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              >
                /
              </span>
            )}
          </div>
          {renderSearchDropdown()}
        </div>

        {/* Right side: Mobile Search Trigger, Live Delivery Watch, Notifications, Theme Toggle, Palette, Profile */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* Mobile Global Search Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !isMobileSearchOpen;
              setIsMobileSearchOpen(next);
              setIsSearchOpen(next);
              setShowNotifications(false);
              setShowPaletteMenu(false);
              setShowProfileMenu(false);
              if (next) {
                requestAnimationFrame(() => mobileInputRef.current?.focus());
              }
            }}
            aria-label="Toggle EDF search"
            aria-expanded={isMobileSearchOpen}
            className={`md:hidden p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer ${
              isMobileSearchOpen
                ? 'bg-rose-50 dark:bg-slate-800 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400'
                : 'text-slate-700 dark:text-slate-200 hover:bg-rose-50/70 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
          {/* LIVE DELIVERY WATCH CARD (Real-time Overdue and Due in 24h) */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-50 via-pink-50/50 to-amber-50 dark:from-rose-950/40 dark:via-slate-900 dark:to-amber-950/30 border border-rose-200/90 dark:border-rose-900/60 shadow-xs">
            <div className="flex items-center gap-1.5 pr-2 border-r border-rose-200 dark:border-rose-800/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="text-[10px] font-black tracking-wider text-rose-900 dark:text-rose-200">
                Live Delivery Watch
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              {/* Overdue */}
              <button
                onClick={onNavigateToOverdue}
                className="flex items-center gap-1 hover:opacity-85 transition-opacity cursor-pointer group"
                title="Click to view all overdue EDFs"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Overdue:</span>
                <span className="font-mono font-black text-xs text-white bg-rose-600 px-1.5 py-0.2 rounded-md shadow-2xs">
                  {liveStats.overdue}
                </span>
              </button>

              {/* Due within 24h */}
              <div className="flex items-center gap-1" title="EDFs due within 24 hours">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Due &lt;24h:</span>
                <span className="font-mono font-black text-xs text-amber-900 dark:text-amber-200 bg-amber-200 dark:bg-amber-950/80 px-1.5 py-0.2 rounded-md border border-amber-300 dark:border-amber-800">
                  {liveStats.due24h}
                </span>
              </div>
            </div>
          </div>

          {/* Offline Sync & Connectivity Indicator */}
          <OfflineSyncBar
            pendingSyncCount={pendingSyncCount}
            isSyncing={isSyncing}
            onSyncNow={onSyncNow}
          />

          {/* PWA Install Button (available in Sidebar on mobile <sm to keep top header within 320px) */}
          <div className="hidden sm:flex items-center">
            <PWAInstallButton variant="header" />
          </div>

          {/* NOTIFICATION BELL WITH LOCAL STATUS UPDATE HISTORY ARRAY */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowPaletteMenu(false);
                setShowProfileMenu(false);
              }}
              className={`relative p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer ${
                showNotifications
                  ? 'bg-rose-50 dark:bg-slate-800 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-rose-50/70 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
              }`}
              title="EDF Status Update Notifications"
              aria-label="EDF Notifications"
            >
              <Bell className="w-4 h-4" />

              {/* Notification Unread Counter Badge */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-white bg-rose-600 flex items-center justify-center shadow-xs animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="fixed inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-auto mt-2 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Dropdown Header */}
                  <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                          <span>Status Notifications</span>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-600 text-white">
                              {unreadCount} new
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          EDFs you created or are monitoring
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
                          title="Mark all notifications as read"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Mark read</span>
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={clearNotificationHistory}
                          className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:underline cursor-pointer flex items-center gap-1"
                          title="Clear notification history"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dropdown Notification History List */}
                  <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-1.5 space-y-1">
                    {notifications.length === 0 ? (
                      <div className="py-8 px-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                          <Bell className="w-5 h-5 opacity-60" />
                        </div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          No status updates yet
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                          You will be alerted here whenever an EDF you created or are monitoring changes status.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const targetEdf = edfs.find((e) => e.id === notif.edfId || (notif.edfNumber && e.edfNumber.toLowerCase() === notif.edfNumber.toLowerCase()));

                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-2.5 rounded-xl transition-all cursor-pointer group flex items-start gap-2.5 ${
                              notif.isRead
                                ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 opacity-80 hover:opacity-100'
                                : 'bg-rose-50/50 dark:bg-rose-950/25 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 border border-rose-100/80 dark:border-rose-900/40'
                            }`}
                          >
                            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs shrink-0 mt-0.5">
                              {getStatusIcon(notif.toStatus)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                    {notif.edfNumber}
                                  </span>
                                  {notif.isUserCreated && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                      Your EDF
                                    </span>
                                  )}
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getCategoryBadgeClass(notif.category)}`}>
                                    {notif.category || 'General'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                  {formatTimeAgo(notif.timestamp)}
                                </span>
                              </div>

                              {notif.notificationTitle ? (
                                <div className="mt-1">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                                    {notif.notificationTitle}
                                  </p>
                                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                                    {notif.notificationMessage}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                                  Status updated to{' '}
                                  <strong className="font-bold text-slate-900 dark:text-white">
                                    {notif.toStatus}
                                  </strong>
                                  {notif.fromStatus && (
                                    <span className="text-slate-400 text-[11px] ml-1">
                                      (was {notif.fromStatus})
                                    </span>
                                  )}
                                </p>
                              )}

                              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                                <span>
                                  Requester: <strong className="text-slate-600 dark:text-slate-300">{notif.requesterName || 'N/A'}</strong>
                                </span>
                                <span className="text-rose-600 dark:text-rose-400 font-bold group-hover:underline text-[10px] flex items-center gap-0.5 ml-auto">
                                  <span>Open EDF Details</span>
                                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                </span>
                              </div>
                            </div>

                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0 mt-1.5 shadow-2xs" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer: Monitoring Mode Control */}
                  <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">
                      Monitoring:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {monitorMode === 'all' ? 'All EDFs' : 'Created & Monitored'}
                      </strong>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextMode = monitorMode === 'all' ? 'created_and_monitored' : 'all';
                        setMonitorMode(nextMode);
                        try {
                          localStorage.setItem('edf_monitor_mode', nextMode);
                        } catch {}
                      }}
                      className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      {monitorMode === 'all' ? 'Monitor Created Only' : 'Monitor All Forms'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Color Palette Switcher (hidden on <sm to prevent mobile topbar crowding; accessible in Settings -> Color Theme) */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => {
                setShowPaletteMenu(!showPaletteMenu);
                setShowProfileMenu(false);
                setShowNotifications(false);
              }}
              className="p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Change theme accent color"
              aria-label="Change color theme"
            >
              <Palette className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span className="hidden xl:inline text-xs font-bold capitalize text-slate-700 dark:text-slate-300">
                Theme
              </span>
            </button>

            {showPaletteMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowPaletteMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2">
                  <div className="px-3 py-1.5 text-[11px] font-black tracking-wider text-rose-500">
                    Grapefruit Palette
                  </div>
                  <div className="space-y-1">
                    {accentOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setAccent(opt.id);
                          setShowPaletteMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                          accent === opt.id
                            ? 'bg-rose-50 dark:bg-slate-800 text-rose-700 dark:text-rose-300'
                            : 'text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3.5 h-3.5 rounded-full ${opt.bg} shadow-xs`} />
                          <span>{opt.label}</span>
                        </div>
                        {accent === opt.id && <Check className="w-3.5 h-3.5 text-rose-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* DAY AND NIGHT TOGGLE BUTTON - High-contrast Grapefruit theme for crystal-clear readability */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-xs active:scale-95 bg-rose-50/80 hover:bg-rose-100/90 text-rose-950 border-rose-300 dark:bg-slate-800/95 dark:hover:bg-slate-750 dark:text-white dark:border-rose-900/80"
            title={`Currently in ${theme === 'dark' ? 'Night (Dark)' : 'Day (Light)'} mode. Click to switch.`}
            aria-label="Toggle dark and light mode"
          >
            {theme === 'dark' ? (
              <>
                <div className="p-0.5 sm:p-1 rounded-lg bg-amber-400/20 text-amber-400">
                  <Sun className="w-3.5 h-3.5 animate-spin-slow" />
                </div>
                <span className="hidden sm:inline font-black text-xs text-white tracking-wide">
                  Day Mode
                </span>
              </>
            ) : (
              <>
                <div className="p-0.5 sm:p-1 rounded-lg bg-rose-600 text-white shadow-2xs">
                  <Moon className="w-3.5 h-3.5" />
                </div>
                <span className="hidden sm:inline font-black text-xs text-rose-950 tracking-wide">
                  Night Mode
                </span>
              </>
            )}
          </button>

          {/* User profile dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowPaletteMenu(false);
                setShowNotifications(false);
              }}
              className="flex items-center gap-1 sm:gap-2 pl-1.5 pr-1.5 sm:pl-2 sm:pr-2.5 py-1 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-700 bg-slate-50/50 dark:bg-slate-900 transition-all text-left cursor-pointer"
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  isAdmin
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {user?.name || 'Coordinator'}
                </p>
                <p className="text-[10px] text-slate-400 font-mono leading-none">
                  {user?.phone}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Dropdown panel */}
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 py-2">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {user?.name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400">
                      {user?.phone}
                    </p>
                    <div className="mt-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isAdmin
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {isAdmin ? <Shield className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                        {isAdmin ? 'Admin (Coordinator)' : 'Visitor (View Only)'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onNavigateToAuditLog) onNavigateToAuditLog();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-rose-500" />
                    <span>Audit Log & History</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onOpenSettings) onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    <span>Change Password & Settings</span>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Expandable Global Search Bar */}
      {isMobileSearchOpen && (
        <div
          ref={mobileSearchRef}
          className="md:hidden px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative"
        >
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={mobileInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search EDF ID, requester, or material..."
              aria-label="Global search for EDFs by ID, requester name, or material description"
              className="w-full h-11 pl-9 pr-10 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400"
            />
            <button
              type="button"
              onClick={() => {
                if (searchQuery) {
                  setSearchQuery('');
                  mobileInputRef.current?.focus();
                } else {
                  setIsMobileSearchOpen(false);
                  setIsSearchOpen(false);
                }
              }}
              aria-label={searchQuery ? 'Clear search' : 'Close search'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            {renderSearchDropdown()}
          </div>
        </div>
      )}
    </header>
  );
};

