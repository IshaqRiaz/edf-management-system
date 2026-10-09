import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { Download, Sparkles, X, Smartphone, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' | 'sidebar' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  // Chromium / Android / Edge Desktop flow
  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install App (Offline)</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white text-xs font-black shadow-sm hover:shadow transition-all cursor-pointer active:scale-95"
        title="Install EDF App to your device for 100% offline access"
        aria-label="Install EDF Management App"
      >
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span className="hidden md:inline">Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-800 dark:text-rose-200 text-xs font-bold transition-all cursor-pointer"
          title="Install on iPhone / iPad for offline use"
        >
          <Smartphone className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden sm:inline">Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative space-y-4">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Install on iPhone / iPad</h3>
                  <p className="text-xs text-slate-400">Save as app for offline demand management</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                  <span>Tap the <strong>Share</strong> icon in the bottom Safari toolbar.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                  <span>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                  <span>Tap <strong>Add</strong> in the top-right corner.</span>
                </p>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-black cursor-pointer shadow-sm hover:opacity-90"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
