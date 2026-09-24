import React from 'react';
import { Fan, Wrench, Zap, Phone, Activity, Package, Layers } from 'lucide-react';

interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, size = 'md' }) => {
  const normalized = category?.trim().toLowerCase() || '';

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  }[size];

  if (normalized.includes('hvac') || normalized.includes('ac')) {
    return (
      <span className={`inline-flex items-center rounded-lg bg-cyan-50 text-cyan-800 ring-1 ring-cyan-600/20 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-500/30 ${sizeClasses}`}>
        <Fan className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
        <span>HVAC / AC</span>
      </span>
    );
  }

  if (normalized.includes('plumb')) {
    return (
      <span className={`inline-flex items-center rounded-lg bg-sky-50 text-sky-800 ring-1 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-500/30 ${sizeClasses}`}>
        <Wrench className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
        <span>Plumbing</span>
      </span>
    );
  }

  if (normalized.includes('generator')) {
    return (
      <span className={`inline-flex items-center rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-500/30 ${sizeClasses}`}>
        <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Generator</span>
      </span>
    );
  }

  if (normalized.includes('telephone') || normalized.includes('telecom')) {
    return (
      <span className={`inline-flex items-center rounded-lg bg-purple-50 text-purple-800 ring-1 ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-500/30 ${sizeClasses}`}>
        <Phone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span>Telephone</span>
      </span>
    );
  }

  if (normalized.includes('electr')) {
    return (
      <span className={`inline-flex items-center rounded-lg bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/30 ${sizeClasses}`}>
        <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>Electrical</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-lg bg-slate-100 text-slate-800 ring-1 ring-slate-600/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 ${sizeClasses}`}>
      <Package className="w-3.5 h-3.5 text-slate-500" />
      <span>{category || 'General / Other'}</span>
    </span>
  );
};
