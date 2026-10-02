import React, { useState } from 'react';
import {
  CalendarRange,
  Calendar,
  X,
  RotateCcw,
  Check,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string, presetName: string) => void;
  onClear: () => void;
  totalFilteredCount?: number;
}

export type DatePresetKey =
  | 'all'
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'this_month'
  | 'last_month'
  | 'custom';

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  onClear,
  totalFilteredCount,
}) => {
  const [activePreset, setActivePreset] = useState<DatePresetKey>(
    startDate || endDate ? 'custom' : 'all'
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Helper date formatter
  const formatDateToYMD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleApplyPreset = (preset: DatePresetKey) => {
    setActivePreset(preset);
    setValidationError(null);
    const now = new Date();

    if (preset === 'all') {
      onClear();
      return;
    }

    if (preset === 'today') {
      const todayStr = formatDateToYMD(now);
      onChange(todayStr, todayStr, 'Today');
      return;
    }

    if (preset === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yStr = formatDateToYMD(yesterday);
      onChange(yStr, yStr, 'Yesterday');
      return;
    }

    if (preset === '7d') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      onChange(formatDateToYMD(past7), formatDateToYMD(now), 'Last 7 Days');
      return;
    }

    if (preset === '30d') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      onChange(formatDateToYMD(past30), formatDateToYMD(now), 'Last 30 Days');
      return;
    }

    if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      onChange(formatDateToYMD(firstDay), formatDateToYMD(lastDay), 'This Month');
      return;
    }

    if (preset === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      onChange(
        formatDateToYMD(firstDayLastMonth),
        formatDateToYMD(lastDayLastMonth),
        'Last Month'
      );
      return;
    }
  };

  const handleStartDateChange = (newStart: string) => {
    setValidationError(null);
    setActivePreset('custom');

    if (endDate && newStart && newStart > endDate) {
      // Auto-adjust end date if start is placed after end
      onChange(newStart, newStart, 'Custom Range');
    } else {
      onChange(newStart, endDate, 'Custom Range');
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    setValidationError(null);
    setActivePreset('custom');

    if (startDate && newEnd && newEnd < startDate) {
      // Auto-adjust start date if end is placed before start
      onChange(newEnd, newEnd, 'Custom Range');
    } else {
      onChange(startDate, newEnd, 'Custom Range');
    }
  };

  const hasActiveDateRange = Boolean(startDate || endDate);

  const presetsList: { id: DatePresetKey; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
  ];

  return (
    <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 space-y-3">
      {/* Header with Title, Range Description, and Clear Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
            <CalendarRange className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Date Range Filter</span>
              {hasActiveDateRange && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </h4>
            <p className="text-[10px] text-slate-400">
              Filter audit entries strictly between start and end timestamps
            </p>
          </div>
        </div>

        {/* Active Range Pill & Clear Button */}
        {hasActiveDateRange && (
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-1.5">
              <span>
                {startDate ? new Date(startDate).toLocaleDateString() : 'Beginning'}
              </span>
              <ArrowRight className="w-3 h-3 text-rose-400" />
              <span>
                {endDate ? new Date(endDate).toLocaleDateString() : 'Today'}
              </span>
              {totalFilteredCount !== undefined && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 font-mono text-[10px]">
                  {totalFilteredCount} logs
                </span>
              )}
            </span>

            <button
              onClick={() => {
                setActivePreset('all');
                onClear();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Reset date range to All Time"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Preset Buttons Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {presetsList.map((preset) => {
          const isSelected =
            preset.id === 'all'
              ? !startDate && !endDate
              : activePreset === preset.id && (startDate || endDate);

          return (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset.id)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-rose-600 text-white shadow-xs font-black'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Specific Start & End Date Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Start Date Input */}
        <div className="space-y-1">
          <label
            htmlFor="audit-date-start"
            className="text-[11px] font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center justify-between"
          >
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-rose-500" />
              <span>Start Date (From)</span>
            </span>
            {startDate && (
              <button
                type="button"
                onClick={() => handleStartDateChange('')}
                className="text-[10px] text-slate-400 hover:text-rose-600"
              >
                Clear
              </button>
            )}
          </label>
          <div className="relative">
            <input
              id="audit-date-start"
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-2xs"
            />
          </div>
        </div>

        {/* End Date Input */}
        <div className="space-y-1">
          <label
            htmlFor="audit-date-end"
            className="text-[11px] font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center justify-between"
          >
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-rose-500" />
              <span>End Date (To)</span>
            </span>
            {endDate && (
              <button
                type="button"
                onClick={() => handleEndDateChange('')}
                className="text-[10px] text-slate-400 hover:text-rose-600"
              >
                Clear
              </button>
            )}
          </label>
          <div className="relative">
            <input
              id="audit-date-end"
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer shadow-2xs"
            />
          </div>
        </div>
      </div>

      {validationError && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 pt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};
