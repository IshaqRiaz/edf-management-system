import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type AccentColor = 'grapefruit' | 'indigo' | 'slate' | 'blue' | 'teal' | 'amber';

export interface ColorThemeConfig {
  id: AccentColor;
  label: string;
  tagline: string;
  primaryHex: string;
  secondaryHex: string;
  swatchClass: string;
  gradientClass: string;
  activeTabClass: string;
  primaryButtonClass: string;
  selectedCardClass: string;
  focusRingClass: string;
  accentTextClass: string;
}

export const COLOR_THEMES: ColorThemeConfig[] = [
  {
    id: 'grapefruit',
    label: 'Grapefruit Coral',
    tagline: 'Signature warm coral · Default',
    primaryHex: '#f43f5e',
    secondaryHex: '#be123c',
    swatchClass: 'bg-rose-500',
    gradientClass: 'from-rose-500 via-rose-600 to-pink-700',
    activeTabClass: 'border-rose-600 text-rose-600 dark:text-rose-400',
    primaryButtonClass: 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20',
    selectedCardClass: 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/35 ring-2 ring-rose-500/25',
    focusRingClass: 'focus:ring-rose-500',
    accentTextClass: 'text-rose-600 dark:text-rose-400',
  },
  {
    id: 'indigo',
    label: 'Indigo Modern',
    tagline: 'Precision operations palette',
    primaryHex: '#4f46e5',
    secondaryHex: '#3730a3',
    swatchClass: 'bg-indigo-600',
    gradientClass: 'from-indigo-600 via-indigo-700 to-violet-800',
    activeTabClass: 'border-indigo-600 text-indigo-600 dark:text-indigo-400',
    primaryButtonClass: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20',
    selectedCardClass: 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/35 ring-2 ring-indigo-500/25',
    focusRingClass: 'focus:ring-indigo-500',
    accentTextClass: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'slate',
    label: 'Slate Executive',
    tagline: 'Architectural monochrome steel',
    primaryHex: '#334155',
    secondaryHex: '#0f172a',
    swatchClass: 'bg-slate-700',
    gradientClass: 'from-slate-700 via-slate-800 to-slate-950',
    activeTabClass: 'border-slate-700 dark:border-slate-300 text-slate-800 dark:text-slate-200',
    primaryButtonClass: 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 shadow-slate-500/20',
    selectedCardClass: 'border-slate-600 dark:border-slate-400 bg-slate-100/80 dark:bg-slate-800/70 ring-2 ring-slate-500/25',
    focusRingClass: 'focus:ring-slate-500',
    accentTextClass: 'text-slate-700 dark:text-slate-300',
  },
  {
    id: 'blue',
    label: 'Corporate Blue',
    tagline: 'Enterprise procurement standard',
    primaryHex: '#2563eb',
    secondaryHex: '#1e40af',
    swatchClass: 'bg-blue-600',
    gradientClass: 'from-blue-600 via-blue-700 to-slate-900',
    activeTabClass: 'border-blue-600 text-blue-600 dark:text-blue-400',
    primaryButtonClass: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
    selectedCardClass: 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/35 ring-2 ring-blue-500/25',
    focusRingClass: 'focus:ring-blue-500',
    accentTextClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'teal',
    label: 'Teal Operations',
    tagline: 'Balanced intake & logistics',
    primaryHex: '#0d9488',
    secondaryHex: '#115e59',
    swatchClass: 'bg-teal-600',
    gradientClass: 'from-teal-600 via-teal-700 to-slate-900',
    activeTabClass: 'border-teal-600 text-teal-600 dark:text-teal-400',
    primaryButtonClass: 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20',
    selectedCardClass: 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/35 ring-2 ring-teal-500/25',
    focusRingClass: 'focus:ring-teal-500',
    accentTextClass: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'amber',
    label: 'Amber Signal',
    tagline: 'High-contrast dispatch accent',
    primaryHex: '#d97706',
    secondaryHex: '#9a3412',
    swatchClass: 'bg-amber-600',
    gradientClass: 'from-amber-600 via-orange-600 to-slate-900',
    activeTabClass: 'border-amber-600 text-amber-700 dark:text-amber-400',
    primaryButtonClass: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
    selectedCardClass: 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/35 ring-2 ring-amber-500/25',
    focusRingClass: 'focus:ring-amber-500',
    accentTextClass: 'text-amber-700 dark:text-amber-400',
  },
];

export function getColorThemeConfig(accent: AccentColor): ColorThemeConfig {
  return COLOR_THEMES.find((t) => t.id === accent) || COLOR_THEMES[0];
}

interface ThemeContextType {
  theme: Theme;
  accent: AccentColor;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('edf_theme') as Theme;
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('edf_accent') as AccentColor;
      if (COLOR_THEMES.some((t) => t.id === stored)) {
        return stored;
      }
    }
    return 'grapefruit'; // Modern Grapefruit theme default!
  });

  // Apply dark mode class to html and body
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      root.classList.remove('light');
      body.classList.remove('light');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      root.classList.add('light');
      body.classList.add('light');
    }

    root.setAttribute('data-theme', theme);
    localStorage.setItem('edf_theme', theme);
  }, [theme]);

  // Apply accent color attribute and brand CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const config = getColorThemeConfig(accent);
    root.setAttribute('data-accent', accent);
    root.style.setProperty('--edf-accent-primary', config.primaryHex);
    root.style.setProperty('--edf-accent-secondary', config.secondaryHex);
    localStorage.setItem('edf_accent', accent);
  }, [accent]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
  };

  return (
    <ThemeContext.Provider value={{ theme, accent, toggleTheme, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
