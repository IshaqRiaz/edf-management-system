import { EDFStatus } from '../types/index.ts';

export type TimerPhase = 'green' | 'orange' | 'red' | 'completed';

export interface RemainingTimeInfo {
  isOverdue: boolean;
  isCompleted: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedText: string;
  shortText: string;
  timerPhase: TimerPhase;
  urgencyLevel: 'completed' | 'overdue' | 'critical' | 'warning' | 'normal';
}

/**
 * Calculates remaining or overdue time according to the exact user criteria:
 * 1. Green: Starting date & more than 24h before required date.
 * 2. Orange: One day before and on the required date (<= 24h remaining).
 * 3. Red: After required date is reached / crossed (Overdue).
 * 4. Completed: When received or completed, stopping the timer.
 */
export function calculateRemainingTime(
  requiredDateStr: string,
  status: EDFStatus,
  receivedDateStr?: string | null,
  completedDateStr?: string | null
): RemainingTimeInfo {
  // Check if completed or received
  const isFinished = status === 'Received' || status === 'Completed';

  if (isFinished) {
    const finishDate = completedDateStr || receivedDateStr || 'Recorded';
    return {
      isOverdue: false,
      isCompleted: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formattedText: status === 'Completed' ? `Completed (${finishDate})` : `Received (${finishDate})`,
      shortText: status,
      timerPhase: 'completed',
      urgencyLevel: 'completed',
    };
  }

  const targetDate = new Date(requiredDateStr);
  const now = new Date();

  // If invalid date
  if (isNaN(targetDate.getTime())) {
    return {
      isOverdue: false,
      isCompleted: false,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formattedText: 'Invalid Date',
      shortText: 'N/A',
      timerPhase: 'green',
      urgencyLevel: 'normal',
    };
  }

  const diffMs = targetDate.getTime() - now.getTime();
  const isOverdue = diffMs < 0 || status === 'Overdue';
  const absDiff = Math.abs(diffMs);

  const totalSeconds = Math.floor(absDiff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  // Exact 3-phase color rule:
  // - Green: > 24 hours before required date
  // - Orange: <= 24 hours remaining (1 day before and on required date)
  // - Red: diffMs < 0 (after required date crossed / overdue)
  let timerPhase: TimerPhase = 'green';
  let urgencyLevel: 'completed' | 'overdue' | 'critical' | 'warning' | 'normal' = 'normal';

  if (isOverdue) {
    timerPhase = 'red';
    urgencyLevel = 'overdue';
  } else if (diffMs <= 24 * 3600 * 1000) {
    // Within 24 hours (1 day before or on the required date)
    timerPhase = 'orange';
    urgencyLevel = 'critical';
  } else {
    // Initial / plenty of time remaining
    timerPhase = 'green';
    urgencyLevel = 'normal';
  }

  if (isOverdue) {
    return {
      isOverdue: true,
      isCompleted: false,
      days,
      hours,
      minutes,
      seconds,
      formattedText: `OVERDUE BY: ${pad(days)} Days ${pad(hours)} Hours ${pad(minutes)} Minutes ${pad(seconds)}s`,
      shortText: `+${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
      timerPhase: 'red',
      urgencyLevel: 'overdue',
    };
  } else {
    return {
      isOverdue: false,
      isCompleted: false,
      days,
      hours,
      minutes,
      seconds,
      formattedText: `${pad(days)} Days ${pad(hours)} Hours ${pad(minutes)} Minutes ${pad(seconds)}s Remaining`,
      shortText: `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
      timerPhase,
      urgencyLevel,
    };
  }
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
