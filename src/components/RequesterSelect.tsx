import React, { useState, useEffect, useRef } from 'react';
import { User, ChevronDown, Check, Plus, Search } from 'lucide-react';

interface RequesterSelectProps {
  value: string;
  onChange: (name: string) => void;
  required?: boolean;
  error?: string;
  className?: string;
}

export const RequesterSelect: React.FC<RequesterSelectProps> = ({
  value,
  onChange,
  required = false,
  error,
  className = '',
}) => {
  const [requesters, setRequesters] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch requesters from API
  useEffect(() => {
    const fetchRequesters = async () => {
      try {
        const token = localStorage.getItem('edf_auth_token');
        const res = await fetch('/api/requesters', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          const names = Array.isArray(data)
            ? data.map((r: any) => (typeof r === 'string' ? r : r.name)).filter(Boolean)
            : [];
          // Deduplicate and sort alphabetically
          const uniqueSorted = Array.from(new Set(names)).sort((a: string, b: string) =>
            a.localeCompare(b)
          );
          setRequesters(uniqueSorted);
        }
      } catch (err) {
        console.warn('Failed to load requesters list:', err);
      }
    };

    fetchRequesters();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter list by search query
  const filteredList = requesters.filter((name) =>
    name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleSelectName = (name: string) => {
    onChange(name);
    setIsCustomMode(false);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleApplyCustom = () => {
    if (customInputValue.trim()) {
      const cleanName = customInputValue.trim();
      onChange(cleanName);
      // Optimistically add to local list if not already present
      if (!requesters.includes(cleanName)) {
        setRequesters((prev) => [...prev, cleanName].sort((a, b) => a.localeCompare(b)));
      }
      setIsCustomMode(false);
      setIsOpen(false);
      setCustomInputValue('');
      setSearchQuery('');
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {isCustomMode ? (
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={customInputValue}
              onChange={(e) => setCustomInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyCustom();
                } else if (e.key === 'Escape') {
                  setIsCustomMode(false);
                }
              }}
              placeholder="Type new requester name & press Enter..."
              className={`w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                error ? 'border-red-500' : 'border-indigo-400 dark:border-indigo-600'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={handleApplyCustom}
            className="px-3 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setIsCustomMode(false)}
            className="px-2.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between pl-3 pr-3 py-2 sm:py-2.5 rounded-xl border bg-white dark:bg-slate-900 text-left text-xs transition-colors cursor-pointer min-h-[38px] sm:min-h-[42px] ${
            error
              ? 'border-red-500'
              : isOpen
              ? 'border-indigo-500 ring-2 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span
              className={`truncate font-medium ${
                value ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-400'
              }`}
            >
              {value || 'Select Requester Name...'}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
              isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
            }`}
          />
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && !isCustomMode && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-72 flex flex-col">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter requester names..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* List items */}
          <div className="overflow-y-auto p-1.5 space-y-0.5 max-h-48 divide-y divide-slate-50 dark:divide-slate-800/40">
            {filteredList.length === 0 ? (
              <div className="py-3 px-3 text-center text-xs text-slate-400">
                No matching requester found
              </div>
            ) : (
              filteredList.map((name) => {
                const isSelected = value.toLowerCase() === name.toLowerCase();
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSelectName(name)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Custom Name / Add New Requester Footer */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setCustomInputValue(searchQuery || '');
                setIsCustomMode(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add / Enter Custom Requester</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
