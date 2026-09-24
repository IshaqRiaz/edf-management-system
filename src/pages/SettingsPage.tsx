import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  HardHat,
  Database,
  Building,
  CheckCircle2,
  Save,
  RotateCcw,
  Sun,
  Moon,
  Palette,
} from 'lucide-react';
import { defaultPdfSettings, OfficePdfSettings } from '../utils/pdfGenerator.ts';
import { useTheme } from '../context/ThemeContext.tsx';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, isDark } = useTheme();
  const [pdfSettings, setPdfSettings] = useState<OfficePdfSettings>(() => {
    try {
      const saved = localStorage.getItem('edf_pdf_settings');
      return saved ? JSON.parse(saved) : defaultPdfSettings;
    } catch {
      return defaultPdfSettings;
    }
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('edf_pdf_settings', JSON.stringify(pdfSettings));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleReset = () => {
    setPdfSettings(defaultPdfSettings);
    localStorage.setItem('edf_pdf_settings', JSON.stringify(defaultPdfSettings));
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          System & Document Configuration
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Customize Coordinator profile and organization headings
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Configuration saved successfully!</span>
        </div>
      )}

      {/* Day / Night Theme Preference Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-[#FF5A5F] flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Interface Color Scheme (Day / Night)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Toggle between Daylight High-Contrast Mode and Midnight Dark Mode
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !isDark
                  ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-300" />
              <span>Day Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isDark
                  ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-sm ring-1 ring-slate-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Moon className="w-4 h-4 text-sky-400" />
              <span>Night Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cloud SQL Database Connection Status Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Google Cloud SQL (PostgreSQL)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Region: asia-southeast1 • Drizzle ORM Schema Active • Auto-status synchronization
            </p>
          </div>
        </div>
      </div>

      {/* Form Settings */}
      <form
        onSubmit={handleSave}
        className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-sky-600" />
            Letterhead & Organization Info
          </h2>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Company / Division Name
            </label>
            <input
              type="text"
              value={pdfSettings.companyName}
              onChange={(e) =>
                setPdfSettings({ ...pdfSettings, companyName: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Department Name
            </label>
            <input
              type="text"
              value={pdfSettings.departmentName}
              onChange={(e) =>
                setPdfSettings({ ...pdfSettings, departmentName: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Office Location
            </label>
            <input
              type="text"
              value={pdfSettings.officeLocation}
              onChange={(e) =>
                setPdfSettings({ ...pdfSettings, officeLocation: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Coordinator Name & Title
            </label>
            <input
              type="text"
              value={pdfSettings.coordinatorName}
              onChange={(e) =>
                setPdfSettings({ ...pdfSettings, coordinatorName: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
