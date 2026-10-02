import { useState, useEffect } from 'react';

export interface TimerResult {
  isOverdue: boolean;
  color: 'green' | 'orange' | 'red' | 'blue';
  formattedText: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isTodayOrTomorrow: boolean;
}

export function parseRequiredDateTarget(requiredDateStr: string | Date): Date {
  if (requiredDateStr instanceof Date) return requiredDateStr;
  if (!requiredDateStr) return new Date();

  const str = String(requiredDateStr).trim();
  // Check if it's YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  // Check if it's an ISO string ending with 00:00:00 or T00:00
  if (str.includes('T00:00:00') || str.includes('T00:00.000Z')) {
    const datePart = str.split('T')[0];
    const [y, m, d] = datePart.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  const d = new Date(str);
  if (isNaN(d.getTime())) return new Date();
  return d;
}

export function calculateLiveTimer(requiredDateStr: string | Date, status?: string): TimerResult {
  if (status === 'Received') {
    return {
      isOverdue: false,
      color: 'blue',
      formattedText: 'Received (Timer Stopped)',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isTodayOrTomorrow: false,
    };
  }

  if (status === 'Completed') {
    return {
      isOverdue: false,
      color: 'green',
      formattedText: 'Completed (Fulfilled)',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isTodayOrTomorrow: false,
    };
  }

  const now = new Date();
  const target = parseRequiredDateTarget(requiredDateStr);

  const diffMs = target.getTime() - now.getTime();
  const isOverdue = diffMs <= 0;

  const absDiff = Math.abs(diffMs);
  const totalSeconds = Math.floor(absDiff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Formatting strings like:
  // "Remaining: 2 Days 08 Hours"
  // "Overdue by: 3 Days 04 Hours"
  let timePortion = '';
  if (days > 0) {
    timePortion = `${days} ${days === 1 ? 'Day' : 'Days'} ${String(hours).padStart(2, '0')} ${hours === 1 ? 'Hour' : 'Hours'}`;
  } else if (hours > 0) {
    timePortion = `${hours} ${hours === 1 ? 'Hour' : 'Hours'} ${String(minutes).padStart(2, '0')} ${minutes === 1 ? 'Min' : 'Mins'}`;
  } else {
    timePortion = `${minutes} ${minutes === 1 ? 'Min' : 'Mins'} ${String(seconds).padStart(2, '0')}s`;
  }

  // Determine color:
  // Green: More than 1 day before Required Date
  // Orange: One day before Required Date (<= 24h) and on Required Date (until deadline)
  // Red: After Required Date (overdue)
  let color: 'green' | 'orange' | 'red' | 'blue' = 'green';
  let formattedText = '';

  const oneDayMs = 24 * 60 * 60 * 1000;
  const isTodayOrTomorrow = !isOverdue && diffMs <= oneDayMs;

  if (isOverdue) {
    color = 'red';
    formattedText = `Overdue by ${timePortion}`;
  } else if (diffMs <= oneDayMs) {
    color = 'orange';
    formattedText = `Remaining: ${timePortion}`;
  } else {
    color = 'green';
    formattedText = `Remaining: ${timePortion}`;
  }

  return {
    isOverdue,
    color,
    formattedText,
    days,
    hours,
    minutes,
    seconds,
    isTodayOrTomorrow,
  };
}

// React hook that triggers a state update every second
export function useLiveTimer(requiredDateStr: string | Date, status?: string): TimerResult {
  const [timer, setTimer] = useState<TimerResult>(() => calculateLiveTimer(requiredDateStr, status));

  useEffect(() => {
    // If status is Received or Completed, timer is stopped
    if (status === 'Received' || status === 'Completed') {
      setTimer(calculateLiveTimer(requiredDateStr, status));
      return;
    }

    const interval = setInterval(() => {
      setTimer(calculateLiveTimer(requiredDateStr, status));
    }, 1000);

    return () => clearInterval(interval);
  }, [requiredDateStr, status]);

  return timer;
}
