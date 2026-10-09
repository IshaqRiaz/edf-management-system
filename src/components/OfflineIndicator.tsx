import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { WifiOff, Wifi, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';

export const OfflineIndicator: React.FC<{ pendingSyncCount?: number }> = ({ pendingSyncCount = 0 }) => {
  const isOnline = useOnlineStatus();
  const [showReconnectedBanner, setShowReconnectedBanner] = useState(false);
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setHasBeenOffline(true);
      setShowReconnectedBanner(false);
    } else if (hasBeenOffline) {
      setShowReconnectedBanner(true);
      const timer = setTimeout(() => {
        setShowReconnectedBanner(false);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, hasBeenOffline]);

  // If online and not newly reconnected, hide banner
  if (isOnline && !showReconnectedBanner) {
    return null;
  }

  // When just reconnected to internet
  if (isOnline && showReconnectedBanner) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-emerald-600/95 dark:bg-emerald-700/95 text-white text-xs font-bold shadow-2xl backdrop-blur-md border border-emerald-400/40 animate-in slide-in-from-bottom-3 duration-200">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
        </span>
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5" />
          <span>Back Online — All data synced automatically</span>
        </div>
      </div>
    );
  }

  // When offline
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/95 dark:bg-amber-600/95 text-white text-xs font-bold shadow-2xl backdrop-blur-md border border-amber-300/40 animate-in slide-in-from-bottom-3 duration-200 max-w-sm"
    >
      <div className="p-1.5 rounded-xl bg-white/20 text-white shrink-0">
        <WifiOff className="w-4 h-4 animate-pulse" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-black uppercase tracking-wider text-[10px] bg-black/20 px-1.5 py-0.5 rounded-md">
            Offline Mode
          </span>
          {pendingSyncCount > 0 && (
            <span className="text-[10px] bg-white/25 px-1.5 py-0.5 rounded-md font-semibold">
              {pendingSyncCount} queued
            </span>
          )}
        </div>
        <p className="text-[11px] font-medium text-amber-50 mt-0.5 leading-snug">
          Full app active. Creations & edits safely saved in IndexedDB.
        </p>
      </div>
    </div>
  );
};
