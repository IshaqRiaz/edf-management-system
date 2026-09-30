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
  highlightClassName = 'bg-amber-200/90 dark:bg-amber-400/30 text-amber-950 dark:text-amber-100 font-bold px-1 py-0.5 rounded-sm border border-amber-400/60 dark:border-amber-400/40 shadow-xs search-highlight',
}) => {
  if (!text) return null;
  if (!query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const trimmed = query.trim();
  // Escape regex special characters
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.toLowerCase() === trimmed.toLowerCase()) {
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
};
