import { useId } from 'react';
import { cn } from '../../lib/utils.js';

export default function Input({ label, hint, error, className, id, ...props }) {
  const generatedId = useId();
  const inputId = id || props.name || generatedId;
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(
          'field',
          error && 'border-danger/60 focus:border-danger focus:ring-danger/10',
        )}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Select({ label, hint, error, className, id, children, ...props }) {
  const generatedId = useId();
  const selectId = id || props.name || generatedId;
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label htmlFor={selectId} className="label">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          className={cn('field appearance-none pr-9', error && 'border-danger/60')}
          {...props}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {error ? (
        <p className="mt-1.5 text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Textarea({ label, hint, className, id, rows = 3, ...props }) {
  const generatedId = useId();
  const areaId = id || props.name || generatedId;
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label htmlFor={areaId} className="label">
          {label}
        </label>
      ) : null}
      <textarea id={areaId} rows={rows} className="field resize-none" {...props} />
      {hint ? <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, className, disabled }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 py-3',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-ink-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-500">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-brand-600' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-premium',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

export function Checkbox({ checked, onChange, label, description, className, disabled, id }) {
  const generatedId = useId();
  id = id || generatedId;
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2.5',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer size-4 appearance-none rounded border border-line-strong bg-white transition-colors checked:border-brand-600 checked:bg-brand-600"
        />
        <svg
          className="pointer-events-none absolute size-3 text-white opacity-0 peer-checked:opacity-100"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m2.5 6 2.2 2.2L9.5 3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-snug text-ink-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-ink-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function SegmentedControl({ options, value, onChange, size = 'md', className }) {
  return (
    <div
      className={cn(
        'inline-flex w-full items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5',
        className,
      )}
      role="group"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange?.(option.value)}
            disabled={option.disabled}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-200 ease-premium disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'h-7 px-2 text-[12px]' : 'h-8 px-3 text-[13px]',
              active
                ? 'bg-white text-ink-900 shadow-card ring-1 ring-black/[0.03]'
                : 'text-ink-500 hover:text-ink-800',
            )}
            title={option.hint}
          >
            {option.icon ? <option.icon className="size-3.5" strokeWidth={2} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
