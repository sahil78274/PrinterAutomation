import { cn } from '../../lib/utils.js';

export function ProgressBar({
  value = 0,
  max = 100,
  tone = 'brand',
  size = 'md',
  className,
  label,
}) {
  const pct = Math.min(Math.max((Number(value) / (Number(max) || 1)) * 100, 0), 100);
  const tones = {
    brand: 'bg-brand-600',
    success: 'bg-success',
    warn: 'bg-warn',
    danger: 'bg-danger',
    ink: 'bg-ink-800',
  };
  const heights = { xs: 'h-1', sm: 'h-1.5', md: 'h-2' };
  return (
    <div className={className}>
      {label ? (
        <div className="mb-1.5 flex justify-between text-[11.5px] text-ink-500">{label}</div>
      ) : null}
      <div className={cn('w-full overflow-hidden rounded-full bg-surface-sunken', heights[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-premium',
            tones[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function LevelBar({ label, value, tone }) {
  const autoTone = tone ?? (value < 20 ? 'danger' : value < 40 ? 'warn' : 'success');
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] text-ink-500">{label}</span>
        <span className="text-[12px] font-medium tabular-nums text-ink-800">{value}%</span>
      </div>
      <ProgressBar value={value} tone={autoTone} size="sm" />
    </div>
  );
}
