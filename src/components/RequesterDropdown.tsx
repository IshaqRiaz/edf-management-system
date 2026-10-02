import React, { useState, useEffect, useRef } from 'react';
import { User, ChevronDown, Check, Plus, Search, X, Loader2 } from 'lucide-react';
import { Requester } from '../types.ts';

interface RequesterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  placeholder?: string;
  className?: string;
}

const FALLBACK_REQUESTERS: string[] = [
  'Ashraf',
  'Azeem Karim',
  'Glacier Eng',
  'Gulsher',
  'Imran',
  'Kamran Alam',
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
  required = false,
  disabled = false,
  error = null,
  placeholder = 'Select Requester Name...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
        if (Array.isArray(data) && data.length > 0) {
          setRequesters(data);
        } else {
          // Use alphabetical fallback
          setRequesters(
            FALLBACK_REQUESTERS.map((name, idx) => ({ id: idx + 1, name }))
          );
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setRequesters(
          FALLBACK_REQUESTERS.map((name, idx) => ({ id: idx + 1, name }))
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  // Filtered requesters
  const filtered = requesters.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const exactMatchExists = requesters.some(
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

  return (
    <div className={`relative w-full min-w-0 ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchQuery('');
          }
        }}
        className={`w-full min-h-[42px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all cursor-pointer text-left ${
          error
            ? 'border-red-500 bg-red-50/20 dark:bg-red-950/20 focus:ring-2 focus:ring-red-400'
            : isOpen
            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-900'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5 truncate min-w-0">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          {value ? (
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {value}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
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
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or type new name..."
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
                No requesters found
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
                  Add <strong>"{searchQuery.trim()}"</strong> as new requester
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
