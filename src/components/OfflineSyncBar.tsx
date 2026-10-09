import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

interface OfflineSyncBarProps {
  pendingSyncCount: number;
  isSyncing: boolean;
  onSyncNow?: () => void;
}

export const OfflineSyncBar: React.FC<OfflineSyncBarProps> = ({
  pendingSyncCount,
  isSyncing,
  onSyncNow,
}) => {
  const isOnline = useOnlineStatus();

  // If online and no pending offline changes to sync, keep UI uncluttered with a subtle indicator in navbar
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {isOnline ? (
        <div
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold shadow-2xs"
          title="Connected to database. Real-time updates active."
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="hidden sm:inline">Online</span>
        </div>
      ) : (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-extrabold shadow-sm animate-pulse"
          title="Working Offline. All creations, edits, and status changes are safely saved in IndexedDB and will auto-sync when internet reconnects."
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode</span>
        </div>
      )}

      {/* Pending Sync Count Badge (Appears when mutations were made while offline) */}
      {pendingSyncCount > 0 && (
        <button
          onClick={onSyncNow}
          disabled={!isOnline || isSyncing}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs transition-all cursor-pointer ${
            isOnline
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
          }`}
          title={
            isOnline
              ? 'Click to sync pending changes to server now'
              : `${pendingSyncCount} changes queued for automatic sync upon reconnect`
          }
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>
            {pendingSyncCount} queued {isSyncing ? '(Syncing...)' : ''}
          </span>
        </button>
      )}
    </div>
  );
};
