import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-8 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
        aria-label={placeholder}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:bg-surface-sunken hover:text-ink-700"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect({ value, onChange, options, label, className }) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-8 text-[12.5px] font-medium text-ink-700 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden
      >
        <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function FilterTabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto no-scrollbar', className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
              active
                ? 'bg-ink-900 text-white'
                : 'text-ink-500 hover:bg-surface-sunken hover:text-ink-900',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  'ml-1.5 rounded px-1 text-[10.5px] tabular-nums',
                  active ? 'bg-white/15 text-white/90' : 'bg-ink-900/[0.06] text-ink-600',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function FilterButton({ children, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors',
        active
          ? 'border-brand-300 bg-brand-50 text-brand-700'
          : 'border-line bg-white text-ink-600 hover:bg-surface-muted',
      )}
    >
      <SlidersHorizontal className="size-3.5" />
      {children}
    </button>
  );
}
