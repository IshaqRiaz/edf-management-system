import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChevronDown, Check, Plus, Search, X, Loader2, AlertCircle } from 'lucide-react';
import { Requester } from '../types.ts';

export interface RequesterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  category?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  placeholder?: string;
  className?: string;
}

export const CATEGORY_REQUESTERS_MAP: Record<string, string[]> = {
  electrical: [
    'Azeem Karim',
    'Imran',
    'Mohammad Azeem',
    'Rasheed',
    'Sarfraz Aziz',
    'Tanveer Ijaz',
  ],
  telephone: [
    'Azeem Karim',
    'Mohammad Azeem',
  ],
  hvac: [
    'Ashraf',
    'Kamran Alam',
    'Sharafat',
  ],
  plumbing: [
    'Gulsher',
    'Nazim',
    'Taimur',
  ],
  generator: [
    'Shahzad',
    'Younas',
  ],
};

export const normalizeCategoryKey = (cat?: string): string => {
  if (!cat) return '';
  const c = cat.toLowerCase().trim();
  if (c.includes('elect')) return 'electrical';
  if (c.includes('tele') || c.includes('phone')) return 'telephone';
  if (c.includes('hvac') || c.includes('ac') || c.includes('air')) return 'hvac';
  if (c.includes('plumb')) return 'plumbing';
  if (c.includes('generator') || (c.includes('gen') && !c.includes('general'))) return 'generator';
  if (c.includes('general') || c.includes('other')) return 'general';
  return c;
};

const FALLBACK_REQUESTERS: string[] = [
  'Ashraf',
  'Azeem Karim',
  'Glacier Eng',
  'Gulsher',
  'Imran',
  'Kamran Alam',
  'Mohammad Azeem',
  'Nazim',
  'Rasheed',
  'Sarfraz Aziz',
  'Shahzad',
  'Sharafat',
  'Taimur',
  'Tanveer Ijaz',
  'Younas',
];

export const RequesterDropdown: React.FC<RequesterDropdownProps> = ({
  value,
  onChange,
  category,
  required = false,
  disabled = false,
  error = null,
  placeholder,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hasCategory = Boolean(category && category.trim());
  const effectiveDisabled = disabled || !hasCategory;

  // Fetch requesters on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const token = typeof window !== 'undefined' ? localStorage.getItem('edf_auth_token') : null;

    fetch('/api/requesters', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        let list: Requester[] = [];
        if (Array.isArray(data) && data.length > 0) {
          list = data;
        } else {
          list = FALLBACK_REQUESTERS.map((name, idx) => ({ id: idx + 1, name }));
        }

        // Ensure both Azeem Karim and Mohammad Azeem are in the pool
        if (!list.some((r) => r.name.toLowerCase() === 'mohammad azeem')) {
          list.push({ id: 18, name: 'Mohammad Azeem' });
        }
        if (!list.some((r) => r.name.toLowerCase() === 'azeem karim')) {
          list.push({ id: 2, name: 'Azeem Karim' });
        }

        // Preserve and display legacy requester value if not already in list
        if (value && value.trim() && !list.some((r) => r.name.toLowerCase() === value.trim().toLowerCase())) {
          list = [...list, { id: 999999, name: value.trim() }];
        }

        setRequesters(list.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {
        if (!isMounted) return;
        let list = FALLBACK_REQUESTERS.map((name, idx) => ({ id: idx + 1, name }));
        if (value && value.trim() && !list.some((r) => r.name.toLowerCase() === value.trim().toLowerCase())) {
          list = [...list, { id: 999999, name: value.trim() }];
        }
        setRequesters(list.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Dynamic Category Filtering
  const categoryRequesters = useMemo(() => {
    // If no category is selected, return empty list (Category must be selected first!)
    if (!hasCategory) {
      return [];
    }

    const norm = normalizeCategoryKey(category);

    // General / Other shows all available requester names
    if (norm === 'general' || !CATEGORY_REQUESTERS_MAP[norm]) {
      return requesters;
    }

    const allowedNames = CATEGORY_REQUESTERS_MAP[norm].map((n) => n.toLowerCase());
    const matched = requesters.filter((r) =>
      allowedNames.includes(r.name.toLowerCase())
    );

    // Ensure all names in map are present in the list
    const result = [...matched];
    CATEGORY_REQUESTERS_MAP[norm].forEach((name) => {
      if (!result.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
        result.push({ id: 888000 + Math.abs(name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)), name });
      }
    });

    // Preserve existing value if editing or already selected
    if (value && value.trim() && !result.some((r) => r.name.toLowerCase() === value.trim().toLowerCase())) {
      result.push({ id: 999999, name: value.trim() });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [category, hasCategory, requesters, value]);

  // Search filter
  const filtered = useMemo(() => {
    return categoryRequesters.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [categoryRequesters, searchQuery]);

  const exactMatchExists = categoryRequesters.some(
    (r) => r.name.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  // Quick-add new requester
  const handleAddNewRequester = async () => {
    const newName = searchQuery.trim();
    if (!newName) return;

    setIsAdding(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('edf_auth_token') : null;

    try {
      const res = await fetch('/api/requesters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        const created: Requester = await res.json();
        setRequesters((prev) => {
          const list = [...prev.filter((r) => r.name !== created.name), created];
          return list.sort((a, b) => a.name.localeCompare(b.name));
        });
        onChange(created.name);
      } else {
        onChange(newName);
      }
    } catch {
      onChange(newName);
    } finally {
      setIsAdding(false);
      setSearchQuery('');
      setIsOpen(false);
    }
  };

  const defaultPlaceholder = !hasCategory
    ? 'Select Category first...'
    : placeholder || `Select ${category} Requester...`;

  return (
    <div className={`relative w-full min-w-0 ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={effectiveDisabled}
        onClick={() => {
          if (!effectiveDisabled) {
            setIsOpen(!isOpen);
            setSearchQuery('');
          }
        }}
        title={!hasCategory ? 'Please select a Category first' : undefined}
        className={`w-full min-h-[42px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all text-left ${
          error
            ? 'border-red-500 bg-red-50/20 dark:bg-red-950/20 focus:ring-2 focus:ring-red-400'
            : isOpen
            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-900'
            : effectiveDisabled
            ? 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/60 text-slate-400 cursor-not-allowed opacity-80'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2.5 truncate min-w-0">
          <User className={`w-4 h-4 shrink-0 ${effectiveDisabled ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'}`} />
          {value ? (
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {value}
            </span>
          ) : (
            <span className={`${effectiveDisabled ? 'text-slate-400 italic' : 'text-slate-400 dark:text-slate-500'} truncate`}>
              {defaultPlaceholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!hasCategory && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Pick Category
            </span>
          )}
          {value && !effectiveDisabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-72 flex flex-col">
          {/* Header Banner Showing Selected Category */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Team: <strong className="text-indigo-600 dark:text-indigo-400">{category}</strong>
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              {categoryRequesters.length} {categoryRequesters.length === 1 ? 'person' : 'people'}
            </span>
          </div>

          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${category} requesters...`}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* List Options */}
          <div className="overflow-y-auto flex-1 p-1 divide-y divide-slate-50 dark:divide-slate-800/40">
            {isLoading ? (
              <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Loading requesters...</span>
              </div>
            ) : filtered.length === 0 && !searchQuery.trim() ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No requesters configured for {category}
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = item.name.toLowerCase() === value.trim().toLowerCase();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.name);
                      setIsOpen(false);
                    }}
                    className={`w-full min-h-[38px] px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}

            {/* Quick Add Custom Name Option */}
            {searchQuery.trim() && !exactMatchExists && (
              <button
                type="button"
                disabled={isAdding}
                onClick={handleAddNewRequester}
                className="w-full min-h-[38px] px-3 py-2.5 rounded-xl text-left text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800"
              >
                {isAdding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">
                  Add <strong>"{searchQuery.trim()}"</strong> to {category}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
