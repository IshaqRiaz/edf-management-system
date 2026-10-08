import React from 'react';

interface HighlightTextProps {
  text: string | null | undefined;
  query: string;
  className?: string;
  highlightClassName?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  query,
  className = '',
  highlightClassName = 'bg-amber-300 dark:bg-amber-400/35 text-amber-950 dark:text-amber-100 font-bold px-1 py-0.5 rounded border border-amber-400/80 dark:border-amber-400/50 shadow-2xs search-highlight inline leading-none',
}) => {
  if (text === null || text === undefined || text === '') return null;
  const str = String(text);

  if (!query || !query.trim()) {
    return <span className={className}>{str}</span>;
  }

  const rawTokens = query.trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) {
    return <span className={className}>{str}</span>;
  }

  // Include both full phrase (if multi-word) and individual words, sorted longest first
  const allTokens = [query.trim(), ...rawTokens];
  const uniqueTokens = Array.from(new Set(allTokens)).sort((a, b) => b.length - a.length);
  const escapedTokens = uniqueTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  try {
    const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
    const parts = str.split(regex);

    return (
      <span className={className}>
        {parts.map((part, index) => {
          const isMatch = uniqueTokens.some((t) => t.toLowerCase() === part.toLowerCase());
          if (isMatch) {
            return (
              <mark key={index} className={highlightClassName}>
                {part}
              </mark>
            );
          }
          return part;
        })}
      </span>
    );
  } catch (e) {
    // Fallback if regex parsing fails
    return <span className={className}>{str}</span>;
  }
};
