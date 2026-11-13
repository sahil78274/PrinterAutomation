import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import Sparkline from '../charts/Sparkline.jsx';

export default function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  spark,
  tone = 'brand',
  className,
}) {
  const positive = typeof delta === 'number' ? delta > 0 : delta === 'up';
  const negative = typeof delta === 'number' ? delta < 0 : delta === 'down';
  const DeltaIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;

  return (
    <div className={cn('card card-hover group p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium text-ink-500">{label}</p>
        {Icon ? (
          <span
            className={cn(
              'grid size-8 place-items-center rounded-lg transition-colors duration-300',
              tone === 'brand' && 'bg-brand-50 text-brand-600 group-hover:bg-brand-100',
              tone === 'success' && 'bg-success/10 text-success',
              tone === 'warn' && 'bg-warn/10 text-warn',
              tone === 'ink' && 'bg-surface-sunken text-ink-600',
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[26px] font-semibold leading-none tracking-[-0.025em] text-ink-900">
            {value}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            {delta !== undefined && delta !== null ? (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums',
                  positive && 'bg-success/10 text-success',
                  negative && 'bg-danger/10 text-danger',
                  !positive && !negative && 'bg-surface-sunken text-ink-500',
                )}
              >
                <DeltaIcon className="size-3" strokeWidth={2.5} />
                {typeof delta === 'number' ? `${Math.abs(delta)}%` : 'flat'}
              </span>
            ) : null}
            {hint ? <span className="truncate text-[11.5px] text-ink-400">{hint}</span> : null}
          </div>
        </div>
        {spark?.length ? (
          <Sparkline
            data={spark}
            width={84}
            height={34}
            color={tone === 'success' ? '#0E9F6E' : tone === 'warn' ? '#C27803' : '#2459E8'}
            className="shrink-0 opacity-80"
          />
        ) : null}
      </div>
    </div>
  );
}
