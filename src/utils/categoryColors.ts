import React from 'react';
import { Wind, Droplets, Zap, Phone, Sparkles, Layers, LucideIcon } from 'lucide-react';

export interface CategoryTheme {
  id: string;
  name: string;
  icon: LucideIcon;
  badgeClass: string;
  hex: string;
  gradient: string;
  lightBg: string;
  borderClass: string;
  dotColor: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  hvac: {
    id: 'HVAC',
    name: 'HVAC',
    icon: Wind,
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    hex: '#0284c7', // Sky 600
    gradient: 'from-sky-500 to-cyan-500',
    lightBg: 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
    borderClass: 'border-sky-300 dark:border-sky-700',
    dotColor: 'bg-sky-500',
  },
  plumbing: {
    id: 'Plumbing',
    name: 'Plumbing',
    icon: Droplets,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    hex: '#2563eb', // Blue 600 (distinct water domain)
    gradient: 'from-blue-600 to-indigo-600',
    lightBg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    borderClass: 'border-blue-300 dark:border-blue-700',
    dotColor: 'bg-blue-500',
  },
  electrical: {
    id: 'Electrical',
    name: 'Electrical',
    icon: Sparkles,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    hex: '#9333ea', // Purple 600 (distinct electric domain, completely different from Blue/Plumbing)
    gradient: 'from-purple-600 to-fuchsia-600',
    lightBg: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
    borderClass: 'border-purple-300 dark:border-purple-700',
    dotColor: 'bg-purple-500',
  },
  generator: {
    id: 'Generator',
    name: 'Generator',
    icon: Zap,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    hex: '#d97706', // Amber 600
    gradient: 'from-amber-500 to-orange-500',
    lightBg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    borderClass: 'border-amber-300 dark:border-amber-700',
    dotColor: 'bg-amber-500',
  },
  telephone: {
    id: 'Telephone',
    name: 'Telephone',
    icon: Phone,
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
    hex: '#0d9488', // Teal 600
    gradient: 'from-teal-500 to-emerald-500',
    lightBg: 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60',
    borderClass: 'border-teal-300 dark:border-teal-700',
    dotColor: 'bg-teal-500',
  },
  general: {
    id: 'General',
    name: 'General',
    icon: Layers,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    hex: '#64748b', // Slate 500
    gradient: 'from-slate-500 to-slate-700',
    lightBg: 'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/60',
    borderClass: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-500',
  },
};

export function getCategoryTheme(categoryName?: string | null): CategoryTheme {
  if (!categoryName) return CATEGORY_THEMES.general;
  const key = categoryName.trim().toLowerCase();
  return CATEGORY_THEMES[key] || {
    id: categoryName,
    name: categoryName,
    icon: Layers,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    hex: '#64748b',
    gradient: 'from-slate-500 to-slate-700',
    lightBg: 'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800/60',
    borderClass: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-500',
  };
}

export function getCategoryBadgeClass(categoryName?: string | null): string {
  return getCategoryTheme(categoryName).badgeClass;
}

export function getCategoryHexColor(categoryName?: string | null): string {
  return getCategoryTheme(categoryName).hex;
}
