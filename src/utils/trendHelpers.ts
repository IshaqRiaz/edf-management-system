import { EDF } from '../types.ts';
import { deduplicateEdfsByNumber, getEffectiveEdfState } from './exportHelpers.ts';

export interface MonthlyTrendPoint {
  monthKey: string; // e.g. "2026-11"
  monthLabel: string; // e.g. "Nov 26"
  fullMonthLabel: string; // e.g. "November 2026"
  submitted: number;
  completed: number;
  completionRate: number;
}

export interface MonthlyTrendSummary {
  data: MonthlyTrendPoint[];
  totalSubmitted: number;
  totalCompleted: number;
  overallCompletionRate: number;
  peakSubmittedMonth: MonthlyTrendPoint;
  peakCompletedMonth: MonthlyTrendPoint;
}

function parseValidDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Resolves the submission date for an EDF (prefers issueDate, falls back to createdAt).
 */
export function getEdfSubmittedDate(edf: EDF): Date | null {
  return parseValidDate(edf.issueDate) || parseValidDate(edf.createdAt);
}

/**
 * Resolves the completion date for an EDF that is effectively Received.
 * Uses the latest item receivedAt timestamp, then statusHistory completion entry,
 * then updatedAt, and finally falls back to submission date.
 */
export function getEdfCompletedDate(edf: EDF): Date | null {
  let latestItemReceived: Date | null = null;
  if (edf.items && edf.items.length > 0) {
    for (const item of edf.items) {
      const recDate = parseValidDate(item.receivedAt);
      if (recDate && (!latestItemReceived || recDate.getTime() > latestItemReceived.getTime())) {
        latestItemReceived = recDate;
      }
    }
  }
  if (latestItemReceived) return latestItemReceived;

  if (edf.statusHistory && edf.statusHistory.length > 0) {
    let latestHistoryReceived: Date | null = null;
    for (const entry of edf.statusHistory) {
      const toSt = String(entry.toStatus || '').toLowerCase();
      if (toSt === 'received' || toSt === 'completed') {
        const hDate = parseValidDate(entry.createdAt);
        if (hDate && (!latestHistoryReceived || hDate.getTime() > latestHistoryReceived.getTime())) {
          latestHistoryReceived = hDate;
        }
      }
    }
    if (latestHistoryReceived) return latestHistoryReceived;
  }

  return parseValidDate(edf.updatedAt) || getEdfSubmittedDate(edf);
}

/**
 * Builds a rolling N-month trend series comparing unique Submitted vs. Completed EDFs.
 */
export function computeMonthlyEdfTrend(
  edfs: EDF[],
  monthsCount: number = 12,
  referenceDate: Date = new Date()
): MonthlyTrendSummary {
  const safeMonthsCount = Math.max(1, Math.min(24, Math.floor(monthsCount)));
  const uniqueEdfs = deduplicateEdfsByNumber(edfs);

  const buckets = new Map<string, MonthlyTrendPoint>();
  const orderedKeys: string[] = [];

  for (let i = safeMonthsCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = toMonthKey(d);
    const shortMonth = d.toLocaleDateString('en-US', { month: 'short' });
    const shortYear = String(d.getFullYear()).slice(-2);
    const fullMonthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const point: MonthlyTrendPoint = {
      monthKey: key,
      monthLabel: `${shortMonth} '${shortYear}`,
      fullMonthLabel,
      submitted: 0,
      completed: 0,
      completionRate: 0,
    };

    buckets.set(key, point);
    orderedKeys.push(key);
  }

  for (const edf of uniqueEdfs) {
    const submittedDate = getEdfSubmittedDate(edf);
    if (submittedDate) {
      const subKey = toMonthKey(submittedDate);
      const bucket = buckets.get(subKey);
      if (bucket) {
        bucket.submitted += 1;
      }
    }

    const state = getEffectiveEdfState(edf, referenceDate.getTime());
    if (state.isReceived) {
      const completedDate = getEdfCompletedDate(edf);
      if (completedDate) {
        const compKey = toMonthKey(completedDate);
        const bucket = buckets.get(compKey);
        if (bucket) {
          bucket.completed += 1;
        }
      }
    }
  }

  const data = orderedKeys.map((key) => {
    const pt = buckets.get(key)!;
    pt.completionRate =
      pt.submitted > 0
        ? Math.min(999, Math.round((pt.completed / pt.submitted) * 100))
        : pt.completed > 0
        ? 100
        : 0;
    return pt;
  });

  const totalSubmitted = data.reduce((sum, pt) => sum + pt.submitted, 0);
  const totalCompleted = data.reduce((sum, pt) => sum + pt.completed, 0);
  const overallCompletionRate =
    totalSubmitted > 0
      ? Math.round((totalCompleted / totalSubmitted) * 100)
      : totalCompleted > 0
      ? 100
      : 0;

  const peakSubmittedMonth = data.reduce(
    (best, cur) => (cur.submitted > best.submitted ? cur : best),
    data[0]
  );
  const peakCompletedMonth = data.reduce(
    (best, cur) => (cur.completed > best.completed ? cur : best),
    data[0]
  );

  return {
    data,
    totalSubmitted,
    totalCompleted,
    overallCompletionRate,
    peakSubmittedMonth,
    peakCompletedMonth,
  };
}
